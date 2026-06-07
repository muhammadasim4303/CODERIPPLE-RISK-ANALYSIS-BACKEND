import { useState } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Github, Bell, Trash2, Sun, Moon, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/hooks/use-toast';
import { wipeUserData } from '@/lib/firebaseService';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';

export default function Settings() {
  useDocumentTitle('Settings');
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // Notification Preferences States
  const [emailNotifications, setEmailNotifications] = useState(() => {
    return localStorage.getItem(`cr_notify_email_${user?.id}`) !== 'false';
  });
  const [highRiskAlerts, setHighRiskAlerts] = useState(() => {
    return localStorage.getItem(`cr_notify_high_risk_${user?.id}`) !== 'false';
  });
  const [weeklySummary, setWeeklySummary] = useState(() => {
    return localStorage.getItem(`cr_notify_weekly_${user?.id}`) !== 'false';
  });
  const [securityAlerts, setSecurityAlerts] = useState(() => {
    return localStorage.getItem(`cr_notify_security_${user?.id}`) !== 'false';
  });

  // Account Deletion States
  const [showConfirm1, setShowConfirm1] = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle Preference Handler
  const handleToggle = (key: string, value: boolean, label: string, setter: (v: boolean) => void) => {
    setter(value);
    if (user?.id) {
      localStorage.setItem(`cr_notify_${key}_${user.id}`, String(value));
    }
    toast({
      title: 'Preferences Updated',
      description: `${label} has been ${value ? 'enabled' : 'disabled'}.`,
    });
  };

  // Perform Complete Data Deletion & Log out
  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      // 1. Wipe Firebase user data (repositories, risk scores, change impact scores, owners)
      await wipeUserData(user.id);

      // 2. Wipe Supabase data associated with user
      await supabase.from('github_tokens').delete().eq('user_id', user.id);
      await supabase.from('issues').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('user_id', user.id);
      if (user.email) {
        await supabase.from('repo_contributors').delete().eq('email', user.email);
      }

      toast({
        title: 'Account Deleted',
        description: 'Your account and all associated data have been permanently wiped.',
        variant: 'destructive',
      });

      // 3. Complete sign-out
      setTimeout(async () => {
        await logout();
      }, 1500);
    } catch (err: any) {
      console.error('[Settings] Account deletion failed:', err);
      toast({
        title: 'Deletion Failed',
        description: err.message || 'An error occurred while deleting your account.',
        variant: 'destructive',
      });
      setIsDeleting(false);
    }
  };

  return (
    <MainLayout title="Settings">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Theme Section */}
        <div className="glass-card rounded-xl p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-primary/10 p-2">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Appearance</h2>
              <p className="text-sm text-muted-foreground">Customize the look and feel</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all',
                theme === 'light'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="rounded-full bg-secondary p-4">
                <Sun className={cn('h-6 w-6', theme === 'light' ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <span className={cn('font-medium', theme === 'light' ? 'text-primary' : 'text-foreground')}>
                Light
              </span>
            </button>
            
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all',
                theme === 'dark'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className="rounded-full bg-secondary p-4">
                <Moon className={cn('h-6 w-6', theme === 'dark' ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <span className={cn('font-medium', theme === 'dark' ? 'text-primary' : 'text-foreground')}>
                Dark
              </span>
            </button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:100ms]">
          <h2 className="mb-6 text-lg font-semibold text-foreground">Profile</h2>
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {user?.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold text-foreground">{user?.username}</h3>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Github className="h-4 w-4" />
                <span>Connected via GitHub</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Preference Section */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:200ms]">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-risk-medium/10 p-2">
              <Bell className="h-5 w-5 text-risk-medium" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Notifications</h3>
              <p className="text-sm text-muted-foreground">Configure alert and preference options</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive system-related email alerts</p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={(checked) => handleToggle('email', checked, 'Email Notifications', setEmailNotifications)}
              />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">High Risk Alerts</p>
                <p className="text-sm text-muted-foreground">Get notified for high-risk commits</p>
              </div>
              <Switch
                checked={highRiskAlerts}
                onCheckedChange={(checked) => handleToggle('high_risk', checked, 'High Risk Alerts', setHighRiskAlerts)}
              />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Weekly Summary</p>
                <p className="text-sm text-muted-foreground">Receive weekly risk summary reports</p>
              </div>
              <Switch
                checked={weeklySummary}
                onCheckedChange={(checked) => handleToggle('weekly', checked, 'Weekly Summary', setWeeklySummary)}
              />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Critical Security Alerts</p>
                <p className="text-sm text-muted-foreground">Immediate alerts for security exposures</p>
              </div>
              <Switch
                checked={securityAlerts}
                onCheckedChange={(checked) => handleToggle('security', checked, 'Critical Security Alerts', setSecurityAlerts)}
              />
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 animate-slide-up [animation-delay:300ms]">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Danger Zone</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Deleting your account will purge all your code risk history, settings, and personal data. This cannot be undone.
          </p>
          <Button variant="destructive" className="gap-2" onClick={() => setShowConfirm1(true)}>
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </div>

      {/* Confirmation Modal 1 */}
      {showConfirm1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300 animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-destructive/30 bg-background/90 shadow-2xl animate-scale-up space-y-6">
            <div className="flex items-center gap-3 text-destructive">
              <Trash2 className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Delete Account</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete your account? This action is <strong className="text-destructive">irreversible</strong> and will permanently wipe:
            </p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
              <li>All repositories, risk scores, and change impact metrics from Firebase.</li>
              <li>Your database profile and integrations scope from Supabase.</li>
              <li>Your linked GitHub configurations.</li>
            </ul>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setShowConfirm1(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowConfirm1(false);
                  setShowConfirm2(true);
                }}
              >
                Proceed
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal 2 */}
      {showConfirm2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300 animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-destructive/50 bg-background/90 shadow-2xl animate-scale-up space-y-6">
            <div className="flex items-center gap-3 text-destructive">
              <Shield className="h-6 w-6 animate-pulse" />
              <h3 className="text-lg font-semibold">Final Confirmation</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Please verify your email <strong className="text-foreground select-all font-mono">{user?.email || 'DELETE MY ACCOUNT'}</strong> by entering it below to complete deletion:
            </p>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Confirm your email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="bg-secondary/50 border-destructive/30 focus:border-destructive text-foreground"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() => {
                  setShowConfirm2(false);
                  setConfirmEmail('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={(confirmEmail !== (user?.email || 'DELETE MY ACCOUNT')) || isDeleting}
                onClick={handleDeleteAccount}
                className="gap-2"
              >
                {isDeleting ? (
                  <>Deleting...</>
                ) : (
                  <>Delete Permanently</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
