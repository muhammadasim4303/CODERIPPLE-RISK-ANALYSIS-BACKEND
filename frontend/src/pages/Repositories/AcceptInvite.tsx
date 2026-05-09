import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Github, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [inviteError, setInviteError] = useState("");
  const [inviteData, setInviteData] = useState<any>(null);
  
  const [githubUsername, setGithubUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteError("Invalid invitation link. No token provided.");
      setIsLoading(false);
      return;
    }

    const checkInvite = async () => {
      try {
        const { data, error } = await supabase
          .from("repo_contributors")
          .select("*")
          .eq("token", token)
          .single();

        if (error || !data) {
          setInviteError("Invalid or expired invitation link.");
        } else if (data.status === "accepted") {
          setInviteError("This invitation has already been accepted.");
        } else {
          setInviteData(data);
        }
      } catch (err) {
        setInviteError("An error occurred while verifying the invitation.");
      } finally {
        setIsLoading(false);
      }
    };

    checkInvite();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUsername.trim()) {
      toast({ title: "Error", description: "GitHub username is required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("repo_contributors")
        .update({
          status: "accepted",
          github_username: githubUsername.trim(),
        })
        .eq("token", token);

      if (error) throw error;
      
      // Attempt to invite the user to the GitHub repository directly!
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/github-add-collaborator`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                repo_name: inviteData.repo_name, 
                github_username: githubUsername.trim() 
            })
        });
        
        const resData = await res.json();
        if (!res.ok) {
            console.error("Failed to add collaborator on GitHub", resData);
            toast({ 
                title: "Added locally, but failed on GitHub", 
                description: resData.error || "Ensure GITHUB_TOKEN is configured in backend.",
                variant: "destructive"
            });
        }
      } catch (ghError) {
        console.error(ghError);
      }
      
      setIsSuccess(true);
      toast({ title: "Success!", description: "You are now a contributor." });
      
      setTimeout(() => {
        navigate(`/repos/${encodeURIComponent(inviteData.repo_name)}`);
      }, 3000);
      
    } catch (err: any) {
      toast({ title: "Failed to accept invite", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying invitation...</p>
        </div>
      </MainLayout>
    );
  }

  if (inviteError) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <AlertCircle className="h-16 w-16 text-destructive/80" />
          <h2 className="text-2xl font-bold text-foreground">Invitation Error</h2>
          <p className="text-muted-foreground">{inviteError}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (isSuccess) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 animate-in fade-in zoom-in duration-500">
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-bold text-foreground">Invitation Accepted!</h2>
          <p className="text-muted-foreground">
            You are now a contributor to <strong>{inviteData?.repo_name}</strong>.
          </p>
          <p className="text-sm text-muted-foreground/60 animate-pulse">Redirecting you to the repository...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="glass-card w-full max-w-md p-8 rounded-2xl shadow-xl animate-slide-up border border-border/50 bg-background/50 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-3 mb-8 text-center">
            <div className="h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center text-primary mb-2">
              <Github className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Accept Invitation</h1>
            <p className="text-muted-foreground text-sm">
              You've been invited to contribute to <br />
              <strong className="text-foreground">{inviteData.repo_name}</strong>
            </p>
          </div>

          <form onSubmit={handleAccept} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="github" className="text-sm font-medium">Link your GitHub Account</Label>
              <Input
                id="github"
                placeholder="Enter your GitHub username"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                className="bg-secondary/50 border-border focus:bg-background transition-colors"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                We'll use this to display your profile picture and contributions.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full gap-2 font-medium"
              disabled={isSubmitting || !githubUsername.trim()}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Accepting...</>
              ) : (
                "Accept Invitation"
              )}
            </Button>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
