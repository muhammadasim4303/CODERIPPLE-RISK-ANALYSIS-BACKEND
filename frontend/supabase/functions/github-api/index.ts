import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getGithubToken(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("github_tokens")
    .select("access_token")
    .eq("user_id", userId)
    .single();

  if (error || !data) throw new Error("GitHub not connected. Please login with GitHub first.");
  return data.access_token;
}

async function githubFetch(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error [${res.status}]: ${body}`);
  }

  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Get GitHub token using admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenData } = await supabaseAdmin
      .from("github_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .single();

    if (!tokenData) {
      return new Response(JSON.stringify({ error: "GitHub not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghToken = tokenData.access_token;

    // Parse the request
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = req.method !== "GET" ? await req.json() : null;

    let result: any;

    switch (action) {
      case "list-repos": {
        const page = url.searchParams.get("page") || "1";
        const per_page = url.searchParams.get("per_page") || "30";
        const sort = url.searchParams.get("sort") || "updated";
        result = await githubFetch(
          `https://api.github.com/user/repos?page=${page}&per_page=${per_page}&sort=${sort}&affiliation=owner,collaborator,organization_member`,
          ghToken
        );
        break;
      }

      case "get-repo": {
        const owner = url.searchParams.get("owner");
        const repo = url.searchParams.get("repo");
        result = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`, ghToken);
        break;
      }

      case "list-commits": {
        const owner = url.searchParams.get("owner");
        const repo = url.searchParams.get("repo");
        const page = url.searchParams.get("page") || "1";
        const per_page = url.searchParams.get("per_page") || "30";
        result = await githubFetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?page=${page}&per_page=${per_page}`,
          ghToken
        );
        break;
      }

      case "get-commit": {
        const owner = url.searchParams.get("owner");
        const repo = url.searchParams.get("repo");
        const sha = url.searchParams.get("sha");
        result = await githubFetch(
          `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
          ghToken
        );
        break;
      }

      case "list-issues": {
        const owner = url.searchParams.get("owner");
        const repo = url.searchParams.get("repo");
        const state = url.searchParams.get("state") || "all";
        const page = url.searchParams.get("page") || "1";
        result = await githubFetch(
          `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&page=${page}&per_page=30`,
          ghToken
        );
        break;
      }

      case "create-issue": {
        const owner = url.searchParams.get("owner");
        const repo = url.searchParams.get("repo");
        result = await githubFetch(
          `https://api.github.com/repos/${owner}/${repo}/issues`,
          ghToken,
          { method: "POST", body: JSON.stringify(body) }
        );
        break;
      }

      case "update-issue": {
        const owner = url.searchParams.get("owner");
        const repo = url.searchParams.get("repo");
        const issue_number = url.searchParams.get("issue_number");
        result = await githubFetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}`,
          ghToken,
          { method: "PATCH", body: JSON.stringify(body) }
        );
        break;
      }

      case "create-repo": {
        result = await githubFetch("https://api.github.com/user/repos", ghToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GitHub API proxy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
