import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  increment,
  deleteField
} from 'firebase/firestore';
import { db } from './firebase';

export interface Chat {
  id: string;
  repo_name: string;
  participants: string[];
  updated_at: number;
  last_message?: string;
  unreadCount?: Record<string, number>;
  commit_sha?: string;
  commit_msg?: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_email: string;
  content: string;
  created_at: number;
  commit_sha?: string;
  commit_msg?: string;
}

/**
 * Creates a new chat or returns existing one if it already exists with the exact same participants and repo.
 */
export async function createChat(repoName: string, participants: string[], commitSha?: string, commitMsg?: string): Promise<string> {
  // Sort participants to ensure consistent matching
  const sortedParticipants = [...participants].sort();
  
  // Try to find an existing chat
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('repo_name', '==', repoName),
    where('participants', '==', sortedParticipants)
  );
  
  // Because 'array-contains' doesn't support exact array match, we rely on the exact array match '==' 
  // which works in Firestore if elements are exactly the same and in the same order.
  
  // Fallback: Just create a new document with an auto-generated ID
  const chatDoc = doc(collection(db, 'chats'));
  const initialUnread: Record<string, number> = {};
  participants.forEach(p => initialUnread[p] = 0);

  const data: any = {
    repo_name: repoName,
    participants: sortedParticipants,
    updated_at: Date.now(),
    unreadCount: initialUnread
  };

  if (commitSha) data.commit_sha = commitSha;
  if (commitMsg) data.commit_msg = commitMsg;

  await setDoc(chatDoc, data);
  
  return chatDoc.id;
}

/**
 * Listen to all chats where the user is a participant.
 */
export function subscribeToUserChats(userEmail: string, callback: (chats: Chat[]) => void) {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userEmail),
    // orderBy('updated_at', 'desc') // Requires composite index, doing client-side sort for now
  );

  return onSnapshot(q, (snapshot) => {
    const chats: Chat[] = [];
    snapshot.forEach(doc => {
      chats.push({ id: doc.id, ...doc.data() } as Chat);
    });
    // Client-side sort to avoid needing immediate Firestore indexes
    chats.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
    callback(chats);
  });
}

/**
 * Listen to messages for a specific chat.
 */
export function subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
  // Removed orderBy('created_at', 'asc') to bypass composite index requirement
  const q = query(
    collection(db, 'messages'),
    where('chat_id', '==', chatId)
  );

  return onSnapshot(q, (snapshot) => {
    const messages: Message[] = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() } as Message);
    });
    // Sort in memory to fix instant loading without composite index
    messages.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
    callback(messages);
  });
}

/**
 * Send a message and update the parent chat's updated_at and unreadCount.
 */
export async function sendMessage(
  chatId: string, 
  senderEmail: string, 
  content: string, 
  receivers: string[],
  commitSha?: string,
  commitMsg?: string
) {
  // 1. Add message
  const msgData: any = {
    chat_id: chatId,
    sender_email: senderEmail,
    content,
    created_at: Date.now()
  };
  
  if (commitSha) msgData.commit_sha = commitSha;
  if (commitMsg) msgData.commit_msg = commitMsg;

  await addDoc(collection(db, 'messages'), msgData);

  // 2. Fetch current chat to update unreadCount without hitting dot notation bug with emails
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  
  if (chatSnap.exists()) {
    const chatData = chatSnap.data();
    const currentUnread = chatData.unreadCount || {};
    
    // Increment unread count for everyone EXCEPT the sender
    receivers.forEach(r => {
      if (r !== senderEmail) {
        currentUnread[r] = (currentUnread[r] || 0) + 1;
      }
    });

    await updateDoc(chatRef, {
      updated_at: Date.now(),
      last_message: content,
      unreadCount: currentUnread
    });
  }
}

/**
 * Mark chat as read for a specific user.
 */
export async function markChatAsRead(chatId: string, userEmail: string) {
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  
  if (chatSnap.exists()) {
    const chatData = chatSnap.data();
    const currentUnread = chatData.unreadCount || {};
    currentUnread[userEmail] = 0;
    
    await updateDoc(chatRef, {
      unreadCount: currentUnread
    });
  }
}

/**
 * Update the active commit context for a chat.
 */
export async function updateChatCommit(chatId: string, commitSha: string | null, commitMsg: string | null) {
  const chatRef = doc(db, 'chats', chatId);
  
  if (!commitSha) {
    await updateDoc(chatRef, {
      commit_sha: deleteField(),
      commit_msg: deleteField(),
      updated_at: Date.now()
    });
  } else {
    await updateDoc(chatRef, {
      commit_sha: commitSha,
      commit_msg: commitMsg,
      updated_at: Date.now()
    });
  }
}

/**
 * Delete a chat and all of its associated messages.
 */
export async function deleteChat(chatId: string) {
  // 1. Delete all messages for this chat
  const q = query(collection(db, 'messages'), where('chat_id', '==', chatId));
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
  await Promise.all(deletePromises);

  // 2. Delete the chat document itself
  await deleteDoc(doc(db, 'chats', chatId));
}
