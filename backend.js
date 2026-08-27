/*
 * BetterIG data adapter
 * ---------------------
 * All shared data goes through this small module so the UI is independent of
 * Supabase. Only the public publishable key is used in the browser.
 */
(function createBetterIGBackend() {
  const config = window.BETTERIG_CONFIG;
  const sdk = window.supabase;
  const client = config && sdk
    ? sdk.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  function requireClient() {
    if (!client) throw new Error("BetterIG could not connect to Supabase.");
    return client;
  }

  async function rpc(name, params) {
    const { data, error } = await requireClient().rpc(name, params);
    if (error) throw error;
    return data;
  }

  window.BetterIGBackend = Object.freeze({
    get available() { return Boolean(client); },

    async getSession() {
      const { data, error } = await requireClient().auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async signInWithGitHub() {
      const redirectTo = config.productionUrl || `${location.origin}${location.pathname}`;
      const { error } = await requireClient().auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo }
      });
      if (error) throw error;
    },

    async signOut() {
      const { error } = await requireClient().auth.signOut();
      if (error) throw error;
    },

    getState() { return rpc("get_my_state"); },
    claimUsername(username, avatarUrl) {
      return rpc("claim_username", { p_username: username, p_avatar_url: avatarUrl || null });
    },
    beginFeed(reelId) { return rpc("begin_feed", { p_reel_id: reelId }); },
    recordScroll(eventId, fromReelId, toReelId) {
      return rpc("record_scroll", {
        p_event_id: eventId,
        p_from_reel_id: fromReelId,
        p_to_reel_id: toReelId
      });
    },
    setLike(reelId, liked) {
      return rpc("set_reel_like", { p_reel_id: reelId, p_liked: liked });
    },
    resolveRoulette(bet) { return rpc("resolve_roulette", { p_bet: bet }); },
    resolveMarket(prediction, stakeRatio) {
      return rpc("resolve_market", { p_prediction: prediction, p_stake_ratio: stakeRatio });
    },

    async getLeaderboard() {
      const { data, error } = await requireClient()
        .from("profiles")
        .select("user_id,username,avatar_url,score")
        .order("score", { ascending: false })
        .order("username", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },

    subscribeToLeaderboard(onChange) {
      if (!client) return () => {};
      const channel = client.channel("betterig-leaderboard")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, onChange)
        .subscribe();
      return () => { client.removeChannel(channel); };
    }
  });
})();
