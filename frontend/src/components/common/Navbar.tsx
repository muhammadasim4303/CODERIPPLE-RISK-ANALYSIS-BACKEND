import { useState, useEffect } from 'react';
import { Bell, Search, User, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import { Link } from 'react-router-dom';
import { formatRelativeTime } from '@/utils/formatters';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface NavbarProps {
  title?: string;
}

export function Navbar({ title }: NavbarProps) {
  const { user, logout } = useAuth();
  const { sidebarOpen } = useApp();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.email) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    };

    fetchNotifications();
    
    // Refresh notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user?.email]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6 transition-all duration-300',
        sidebarOpen ? 'left-64' : 'left-16'
      )}
    >
      {/* Left: Title/Search */}
      <div className="flex items-center gap-4">
        {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories, commits..."
            className="w-72 bg-secondary/50 pl-10 text-sm border-border focus:ring-primary"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-risk-high border-2 border-background" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-popover border-border max-h-96 overflow-y-auto">
            <div className="px-3 py-2 border-b border-border flex justify-between items-center sticky top-0 bg-popover z-10">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={cn("px-3 py-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors flex flex-col gap-1", !n.read && "bg-primary/5")}>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-medium leading-tight">{n.title}</span>
                    {!n.read && (
                      <button onClick={(e) => { e.preventDefault(); markAsRead(n.id); }} className="text-muted-foreground hover:text-primary transition-colors shrink-0" title="Mark as read">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground break-words">{n.message}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-muted-foreground/70">{formatRelativeTime(n.created_at)}</span>
                    {n.link && (
                      <Link 
                        to={n.link} 
                        className="text-xs text-primary font-medium hover:underline"
                        onClick={() => { if (!n.read) markAsRead(n.id); }}
                      >
                        View Details
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar_url} alt={user?.username} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-block">{user?.username}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">{user?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={logout} className="gap-2 text-destructive cursor-pointer focus:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
