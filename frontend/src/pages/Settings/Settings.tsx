import { MainLayout } from '@/components/layouts/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Github, Key, Bell, Shield, RefreshCw, Trash2, Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme, toggleTheme } = useTheme();

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

        {/* GitHub Token */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:200ms]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">GitHub Access Token</h3>
                <p className="text-sm text-muted-foreground">Manage your GitHub integration</p>
              </div>
            </div>
            <Button variant="outline" className="gap-2 border-border">
              <RefreshCw className="h-4 w-4" />
              Refresh Token
            </Button>
          </div>
          <Separator className="my-6 bg-border" />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token" className="text-foreground">Personal Access Token</Label>
              <Input
                id="token"
                type="password"
                value="ghp_xxxxxxxxxxxxxxxxxxxx"
                readOnly
                className="bg-secondary/50 border-border font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your token is encrypted and securely stored. Last updated 2 days ago.
            </p>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:300ms]">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-risk-medium/10 p-2">
              <Bell className="h-5 w-5 text-risk-medium" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Notifications</h3>
              <p className="text-sm text-muted-foreground">Configure alert preferences</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">High Risk Alerts</p>
                <p className="text-sm text-muted-foreground">Get notified for high-risk commits</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Weekly Summary</p>
                <p className="text-sm text-muted-foreground">Receive weekly risk summary emails</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Critical Security Alerts</p>
                <p className="text-sm text-muted-foreground">Immediate alerts for security issues</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Analysis Settings */}
        <div className="glass-card rounded-xl p-6 animate-slide-up [animation-delay:400ms]">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-risk-low/10 p-2">
              <Shield className="h-5 w-5 text-risk-low" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Analysis Configuration</h3>
              <p className="text-sm text-muted-foreground">Customize risk analysis behavior</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Auto-analyze new commits</p>
                <p className="text-sm text-muted-foreground">Automatically analyze commits on push</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator className="bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Include test files</p>
                <p className="text-sm text-muted-foreground">Analyze test files for risk assessment</p>
              </div>
              <Switch />
            </div>
            <Separator className="bg-border" />
            <div className="space-y-2">
              <Label className="text-foreground">AI Model Version</Label>
              <Input value="CodeRisk v2.4.1" readOnly className="bg-secondary/50 border-border" />
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 animate-slide-up [animation-delay:500ms]">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Danger Zone</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
