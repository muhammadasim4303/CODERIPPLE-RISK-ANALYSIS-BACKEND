import { useState, useEffect, useRef } from 'react';
import { MessageCircle, ArrowLeft, Send, Users, Plus, X, GitCommit, Trash2, Check } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useRepositories } from '@/hooks/useRepositories';
import { supabase } from '@/lib/supabaseClient';
import { formatRelativeTime } from '@/utils/formatters';
import { listCommits, GHCommit } from '@/lib/githubService';
import {
  Chat,
  Message,
  subscribeToUserChats,
  subscribeToMessages,
  createChat,
  sendMessage,
  markChatAsRead,
  updateChatCommit,
  deleteChat
} from '@/lib/chatService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MessagesSheetProps {
  children: React.ReactNode;
}

export function MessagesSheet({ children }: MessagesSheetProps) {
  const { user } = useAuth();
  const { repositories } = useRepositories();
  const [isOpen, setIsOpen] = useState(false);

  // Inbox State
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New Chat State
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [contributors, setContributors] = useState<any[]>([]);
  const [selectedReceivers, setSelectedReceivers] = useState<string[]>([]);
  const [isFetchingContributors, setIsFetchingContributors] = useState(false);
  const [repoCommits, setRepoCommits] = useState<GHCommit[]>([]);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string>('');

  // Messages State
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Load User's Chats
  useEffect(() => {
    if (!user?.email || !isOpen) return;
    const unsubscribe = subscribeToUserChats(user.email, (fetchedChats) => {
      setChats(fetchedChats);
      
      // Keep activeChat synced with real-time updates (like commit selections, unread counts)
      setActiveChat(prev => {
        if (!prev) return null;
        const updated = fetchedChats.find(c => c.id === prev.id);
        return updated || prev;
      });
    });
    return () => unsubscribe();
  }, [user?.email, isOpen]);

  // 2. Load Messages when Active Chat changes
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }
    const unsubscribe = subscribeToMessages(activeChat.id, (fetched) => {
      setMessages(fetched);
      if (user?.email && activeChat.unreadCount?.[user.email] && activeChat.unreadCount[user.email] > 0) {
        markChatAsRead(activeChat.id, user.email);
      }
    });
    return () => unsubscribe();
  }, [activeChat?.id, user?.email]);

  // 3. Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Fetch contributors, owner email, and commits when a repo is selected
  useEffect(() => {
    if (!selectedRepo) {
      setContributors([]);
      setRepoCommits([]);
      setSelectedCommitSha('');
      return;
    }
    const fetchContext = async () => {
      setIsFetchingContributors(true);
      const [ownerName, repoName] = selectedRepo.split('/');

      // 4a. Fetch accepted contributors
      const { data: contribData } = await supabase
        .from('repo_contributors')
        .select('*')
        .eq('repo_name', selectedRepo)
        .eq('status', 'accepted');

      let allSelectable = contribData ? [...contribData] : [];

      // 4b. Fetch the repo owner's email from profiles so contributors can message them
      if (ownerName) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('email')
          .ilike('github_username', ownerName)
          .single();

        if (ownerProfile?.email) {
          // If owner is not already in the list, add them as a mock contributor
          if (!allSelectable.find(c => c.email === ownerProfile.email)) {
            allSelectable.push({ email: ownerProfile.email, isOwner: true });
          }
        }
      }

      // Exclude current user from receiver list options
      const others = allSelectable.filter(c => c.email !== user?.email);
      setContributors(others);
      setIsFetchingContributors(false);

    };
    fetchContext();
  }, [selectedRepo, user?.email]);

  // 5. Fetch commits for active chat context
  useEffect(() => {
    if (!activeChat) {
      setRepoCommits([]);
      return;
    }
    const fetchActiveCommits = async () => {
      const [ownerName, repoName] = activeChat.repo_name.split('/');
      try {
        const commits = await listCommits(ownerName, repoName, 1);
        setRepoCommits(commits);
      } catch (e) {
        console.error("Failed to load commits for chat", e);
      }
    };
    fetchActiveCommits();
  }, [activeChat?.repo_name]);

  const handleCreateChat = async () => {
    if (!selectedRepo || selectedReceivers.length === 0 || !user?.email) return;
    const participants = [user.email, ...selectedReceivers];

    const chatId = await createChat(selectedRepo, participants);

    // Find or mock the chat object to switch view
    const newChat: Chat = {
      id: chatId,
      repo_name: selectedRepo,
      participants,
      updated_at: Date.now()
    };
    setActiveChat(newChat);
    setIsCreatingNew(false);
    setSelectedRepo('');
    setSelectedReceivers([]);
    setSelectedCommitSha('');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user?.email) return;

    const content = newMessage.trim();
    setNewMessage('');
    await sendMessage(
      activeChat.id,
      user.email,
      content,
      activeChat.participants,
      activeChat.commit_sha,
      activeChat.commit_msg
    );
  };

  const handleAttachCommit = async (commitSha: string, commitMsg: string) => {
    if (!activeChat) return;
    await updateChatCommit(activeChat.id, commitSha, commitMsg);
  };

  const handleDeleteChat = async () => {
    if (!activeChat) return;
    if (confirm("Are you sure you want to delete this chat? All message history will be permanently deleted for all participants.")) {
      await deleteChat(activeChat.id);
      setActiveChat(null);
    }
  };

  const totalUnread = user?.email ? chats.reduce((sum, c) => sum + (c.unreadCount?.[user.email] || 0), 0) : 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setActiveChat(null);
        setIsCreatingNew(false);
      }
    }}>
      <SheetTrigger asChild>
        <div className="relative cursor-pointer">
          {children}
          {totalUnread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-risk-high text-[9px] font-bold text-white border-background border">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col border-l border-border bg-card">
        {/* HEADER */}
        <SheetHeader className="p-4 border-b border-border bg-background sticky top-0 z-10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {(activeChat || isCreatingNew) && (
              <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={() => {
                setActiveChat(null);
                setIsCreatingNew(false);
              }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle className="text-lg">
              {isCreatingNew ? 'New Chat' : activeChat ? activeChat.repo_name : 'Messages'}
            </SheetTitle>
          </div>
          <div className="flex items-center gap-2">
            {activeChat && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleDeleteChat} title="Delete Chat">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {!activeChat && !isCreatingNew && (
              <Button variant="outline" size="sm" onClick={() => setIsCreatingNew(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Chat
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col relative">

          {/* VIEW 1: Inbox List */}
          {!activeChat && !isCreatingNew && (
            <div className="flex flex-col p-2 space-y-1">
              {chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
                  <p>No messages yet.</p>
                </div>
              ) : (
                chats.map(chat => {
                  const unread = user?.email ? (chat.unreadCount?.[user.email] || 0) : 0;
                  const otherParticipants = chat.participants.filter(p => p !== user?.email);

                  return (
                    <div
                      key={chat.id}
                      onClick={() => setActiveChat(chat)}
                      className="flex items-center gap-3 p-3 rounded-md hover:bg-secondary/50 cursor-pointer transition-colors relative"
                    >
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {otherParticipants.length > 1 ? <Users className="h-4 w-4" /> : otherParticipants[0]?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {chat.repo_name.split('/')[1] || chat.repo_name}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {chat.updated_at ? formatRelativeTime(new Date(chat.updated_at)) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {chat.last_message ? chat.last_message : `Chat with ${otherParticipants.length} people`}
                        </p>
                      </div>
                      {unread > 0 && (
                        <div className="h-5 w-5 rounded-full bg-risk-high flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm border border-background">
                          {unread > 9 ? '9+' : unread}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW 2: New Chat Form */}
          {isCreatingNew && (
            <div className="p-4 flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Select Repository Context</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                >
                  <option value="" disabled>Select a repository...</option>
                  {repositories.map(repo => (
                    <option key={repo.full_name} value={repo.full_name}>{repo.full_name}</option>
                  ))}
                </select>
              </div>

              {selectedRepo && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Select Receivers</label>
                  {isFetchingContributors ? (
                    <p className="text-xs text-muted-foreground">Loading contributors...</p>
                  ) : contributors.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 border border-dashed border-border rounded-md">No accepted contributors found for this repo.</p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto p-1">
                      {contributors.map(c => (
                        <label key={c.email} className="flex items-center space-x-3 p-2 rounded hover:bg-secondary/40 cursor-pointer border border-transparent hover:border-border transition-colors">
                          <input
                            type="checkbox"
                            className="rounded border-input text-primary focus:ring-primary w-4 h-4"
                            checked={selectedReceivers.includes(c.email)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedReceivers([...selectedReceivers, c.email]);
                              else setSelectedReceivers(selectedReceivers.filter(r => r !== c.email));
                            }}
                          />
                          <span className="text-sm text-foreground flex-1">
                            {c.email}
                            {c.isOwner && <span className="ml-2 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Owner</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                className="mt-4"
                disabled={!selectedRepo || selectedReceivers.length === 0}
                onClick={handleCreateChat}
              >
                Start Conversation
              </Button>
            </div>
          )}

          {/* VIEW 3: Chat Interface */}
          {activeChat && (
            <div className="flex flex-col h-full absolute inset-0">
              <div className="bg-secondary/30 px-4 py-2 border-b border-border text-xs text-muted-foreground flex items-center justify-between">
                <span>{activeChat.participants.length} Participants</span>
                <span className="truncate max-w-[200px]" title={activeChat.participants.join(', ')}>
                  {activeChat.participants.filter(p => p !== user?.email).join(', ')}
                </span>
              </div>

              {activeChat.commit_sha && (
                <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <GitCommit className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center">
                      <a
                        href={`https://github.com/${activeChat.repo_name}/commit/${activeChat.commit_sha}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline cursor-pointer"
                      >
                        {activeChat.commit_sha.substring(0, 7)}
                      </a>
                      <span className="text-muted-foreground ml-2 truncate inline-block max-w-[200px] align-bottom">
                        {activeChat.commit_msg?.split('\n')[0]}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleAttachCommit('', '')} title="Clear commit context">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground mt-10">Start of conversation</p>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_email === user?.email;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {msg.commit_sha && (
                          <a
                            href={`https://github.com/${activeChat.repo_name}/commit/${msg.commit_sha}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-primary hover:underline mb-1 font-medium bg-primary/10 px-2 py-0.5 rounded-md"
                          >
                            <GitCommit className="h-3 w-3" />
                            {msg.commit_sha.substring(0, 7)}
                          </a>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary text-secondary-foreground rounded-bl-sm'
                          }`}>
                          <p>{msg.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {!isMe && <span className="text-[10px] text-muted-foreground/70">{msg.sender_email.split('@')[0]}</span>}
                          <span className="text-[10px] text-muted-foreground/50">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="absolute bottom-0 left-0 right-0 p-3 bg-background border-t border-border flex items-center gap-2">

                {repoCommits.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {activeChat.commit_sha ? (
                        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 px-3 rounded-full border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary" title="Change commit context">
                          <GitCommit className="h-3 w-3 mr-1" />
                          <span className="font-mono text-[10px] font-semibold">{activeChat.commit_sha.substring(0, 7)}</span>
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground" title="Attach commit context">
                          <GitCommit className="h-5 w-5" />
                        </Button>
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-80 mb-2 p-0 max-h-60 overflow-y-auto">
                      <div className="px-3 py-2 border-b border-border sticky top-0 bg-popover z-10 font-medium text-sm flex justify-between items-center">
                        Select commit context
                        {activeChat.commit_sha && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => {
                            e.preventDefault();
                            handleAttachCommit('', '');
                          }}>
                            Clear
                          </Button>
                        )}
                      </div>
                      {repoCommits.map(commit => (
                        <DropdownMenuItem
                          key={commit.sha}
                          className="px-3 py-2 border-b border-border/50 cursor-pointer flex items-center gap-2 focus:bg-secondary/50"
                          onClick={() => handleAttachCommit(commit.sha, commit.commit.message)}
                        >
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            {activeChat.commit_sha === commit.sha && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <span className="font-mono text-xs font-semibold text-primary">{commit.sha.substring(0, 7)}</span>
                            <span className="text-xs text-muted-foreground truncate w-full">{commit.commit.message.split('\n')[0]}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full bg-secondary/50 border-transparent focus-visible:ring-primary focus-visible:ring-1"
                />
                <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0" disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4 ml-0.5" />
                </Button>
              </form>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
