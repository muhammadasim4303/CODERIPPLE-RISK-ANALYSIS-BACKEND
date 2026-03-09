import { useState } from 'react';
import { Github, Zap, Shield, GitCommit, ArrowRight, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup, loginWithGitHub, isAuthenticated, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', username: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isAuthenticated) { navigate('/dashboard'); return null; }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.email) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Invalid email';
    if (!formData.password) e.password = 'Password is required';
    else if (formData.password.length < 6) e.password = 'Min 6 characters';
    if (activeTab === 'signup') {
      if (!formData.username || formData.username.length < 3) e.username = 'Min 3 characters';
      if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      if (activeTab === 'login') await login(formData.email, formData.password);
      else await signup(formData.email, formData.password, formData.username);
      navigate('/dashboard');
    } catch (err: any) {
      setErrors({ form: err?.message ?? 'Authentication failed. Please try again.' });
    }
  };

  const handleGitHub = async () => {
    try { await loginWithGitHub(); }
    catch (err: any) { setErrors({ form: err?.message ?? 'GitHub login failed.' }); }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-gradient-to-r from-primary/5 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Left branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20">
          <div className="max-w-lg">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold"><span className="gradient-text">CodeRipple</span></h1>
                <p className="text-sm text-muted-foreground">AI Analyzer</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold text-foreground leading-tight mb-6">
              Analyze your code changes with{' '}<span className="gradient-text">AI-powered</span> risk detection
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Get instant insights on commit risks, security vulnerabilities, and change impact across all your repositories.
            </p>
            <div className="space-y-5">
              {[
                { icon: <Shield className="h-5 w-5 text-risk-low" />, bg: 'bg-risk-low/10', title: 'Security Analysis', desc: 'Detect vulnerabilities before they reach production' },
                { icon: <GitCommit className="h-5 w-5 text-primary" />, bg: 'bg-primary/10', title: 'Commit Insights', desc: 'Understand the impact of every code change' },
                { icon: <ArrowRight className="h-5 w-5 text-risk-medium" />, bg: 'bg-risk-medium/10', title: 'Dependency Tracking', desc: 'Visualize how changes cascade through your codebase' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 glass-card rounded-xl p-4 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', item.bg)}>{item.icon}</div>
                  <div>
                    <h3 className="font-medium text-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right auth */}
        <div className="flex w-full lg:w-1/2 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight"><span className="gradient-text">CodeRipple</span></h1>
              <p className="mt-2 text-muted-foreground">AI-Powered Commit Risk Analyzer</p>
            </div>

            <div className="glass-card rounded-2xl p-8">
              <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'login' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50 border border-border">
                  <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Sign Up</TabsTrigger>
                </TabsList>

                {errors.form && (
                  <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">{errors.form}</div>
                )}

                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="login-email" name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={onChange} className={cn('pl-10 bg-secondary/50 border-border', errors.email && 'border-destructive')} />
                      </div>
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <button type="button" className="text-xs text-primary hover:underline">Forgot password?</button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="login-password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={onChange} className={cn('pl-10 pr-10 bg-secondary/50 border-border', errors.password && 'border-destructive')} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
                      {isLoading ? 'Signing in…' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-username">Username</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="signup-username" name="username" type="text" placeholder="johndoe" value={formData.username} onChange={onChange} className={cn('pl-10 bg-secondary/50 border-border', errors.username && 'border-destructive')} />
                      </div>
                      {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="signup-email" name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={onChange} className={cn('pl-10 bg-secondary/50 border-border', errors.email && 'border-destructive')} />
                      </div>
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="signup-password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={onChange} className={cn('pl-10 pr-10 bg-secondary/50 border-border', errors.password && 'border-destructive')} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="signup-confirm" name="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.confirmPassword} onChange={onChange} className={cn('pl-10 bg-secondary/50 border-border', errors.confirmPassword && 'border-destructive')} />
                      </div>
                      {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
                      {isLoading ? 'Creating account…' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or continue with</span></div>
              </div>

              <Button onClick={handleGitHub} variant="outline" className="w-full h-11 gap-3 border-border bg-secondary/50 hover:bg-secondary text-foreground">
                <Github className="h-5 w-5" />
                GitHub
              </Button>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                By continuing, you agree to our{' '}
                <a href="#" className="text-primary hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
