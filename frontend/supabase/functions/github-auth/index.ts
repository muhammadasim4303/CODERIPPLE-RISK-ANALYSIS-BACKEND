import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: "Missing code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GITHUB_CLIENT_ID = Deno.env.get("GITHUB_CLIENT_ID");
    const GITHUB_CLIENT_SECRET = Deno.env.get("GITHUB_CLIENT_SECRET");

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      throw new Error("GitHub OAuth credentials not configured");
    }

    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    // Get GitHub user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
    });
    const githubUser = await userRes.json();

    // Get primary email
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github.v3+json" },
    });
    const emails = await emailsRes.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email || githubUser.email || `${githubUser.login}@github.local`;

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to find existing user by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === primaryEmail);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update user metadata
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          avatar_url: githubUser.avatar_url,
          user_name: githubUser.login,
          full_name: githubUser.name || githubUser.login,
        },
      });
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: primaryEmail,
        email_confirm: true,
        user_metadata: {
          avatar_url: githubUser.avatar_url,
          user_name: githubUser.login,
          full_name: githubUser.name || githubUser.login,
        },
      });

      if (createError) throw createError;
      userId = newUser.user.id;
    }

    // Store/update GitHub token
    const { error: tokenError } = await supabaseAdmin
      .from("github_tokens")
      .upsert(
        {
          user_id: userId,
          access_token: accessToken,
          token_type: tokenData.token_type || "bearer",
          scope: scope,
        },
        { onConflict: "user_id" }
      );

    if (tokenError) console.error("Token storage error:", tokenError);

    // Update profile with GitHub username
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          username: githubUser.login,
          email: primaryEmail,
          avatar_url: githubUser.avatar_url,
          github_username: githubUser.login,
        },
        { onConflict: "user_id" }
      );

    // Generate magic link for session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: primaryEmail,
    });

    if (linkError) throw linkError;

    return new Response(
      JSON.stringify({
        token_hash: linkData.properties?.hashed_token,
        email: primaryEmail,
        github_user: {
          login: githubUser.login,
          avatar_url: githubUser.avatar_url,
          name: githubUser.name,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("GitHub auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
