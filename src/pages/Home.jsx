import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// ==== ASSETS (fallback images) ====
import Logo from "../assets/logo.png";
import HIWSignup from "../assets/hiw-signup.png";
import HIWSearch from "../assets/hiw-search.png";
import HIWConnect from "../assets/hiw-connect.png";
import ImgAccra from "../assets/accra.jpg";
import ImgKumasi from "../assets/kumasi.jpg";
import ImgTakoradi from "../assets/takoradi.jpg";

export default function Home() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [budget, setBudget] = useState("");
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      const res = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      sub = res.data.subscription;
    })();
    return () => sub?.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, city, price, price_ghs, image_url, is_featured, is_published, created_at")
        .eq("is_featured", true)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) setErr(error.message);
      else setFeatured(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchText) params.set("city", searchText);
    if (budget) params.set("max", budget);
    navigate(`/listings?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6] text-[#2A1E14]">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-30 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-xl tracking-tight">Gida</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/search" className="hover:opacity-70">Find Room</Link>
            <Link to="/listings" className="hover:opacity-70">Listings</Link>
            <Link to="/messages" className="hover:opacity-70">Messages</Link>

            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/app/my-listings"
                  className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90"
                >
                  View Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="text-sm underline underline-offset-4 hover:opacity-70"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90"
              >
                Sign Up
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* PAGE CONTAINER */}
      <main className="mx-auto max-w-6xl px-4">
        {/* HERO */}
        <section className="pt-12 pb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-center">
            Find your Gida,<br className="hidden md:block" />
            <span> find your people.</span>
          </h1>

          {/* Search bar */}
          <form
            onSubmit={onSearch}
            className="mt-8 mx-auto w-full md:w-[760px] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-3 flex flex-col md:flex-row gap-3"
          >
            <input
              type="text"
              placeholder="Location"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 rounded-xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
            />
            <input
              type="number"
              placeholder="Budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="flex-1 rounded-xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#3B2719] text-white px-6 py-3 font-semibold hover:opacity-90"
            >
              Search
            </button>
          </form>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center">How it Works</h2>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <img src={HIWSignup} alt="Sign Up" className="h-36 object-contain" />
              <p className="mt-4 text-lg font-semibold">Sign Up</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <img src={HIWSearch} alt="Search" className="h-36 object-contain" />
              <p className="mt-4 text-lg font-semibold">Search Rooms or<br />List Your Space</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <img src={HIWConnect} alt="Connect" className="h-36 object-contain" />
              <p className="mt-4 text-lg font-semibold">Connect<br />with Roommates or Renters</p>
            </div>
          </div>
        </section>

        {/* POPULAR LISTINGS */}
        <section className="py-6 pb-16">
          <h3 className="text-2xl md:text-3xl font-extrabold">Popular Listings</h3>

          {err && <p className="mt-3 text-red-600">{err}</p>}
          {loading && <p className="mt-3 opacity-70">Loading listings…</p>}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.length > 0
              ? featured.map((item) => {
                  const img = item.image_url?.startsWith("http")
                    ? item.image_url
                    : item.image_url || "/images/placeholder.jpg";
                  const price = item.price ?? item.price_ghs;
                  return (
                    <article key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                      <div className="relative h-48">
                        <img src={img} alt={item.title || item.city} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-4">
                        <h4 className="text-xl font-bold">{item.city}</h4>
                        {price != null && (
                          <p className="mt-1 text-[#3B2719] font-semibold">
                            GHS {Number(price).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })
              : (
                <>
                  <article className="bg-white rounded-2xl overflow-hidden shadow">
                    <div className="relative h-48">
                      <img src={ImgAccra} alt="Accra" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4">
                      <h4 className="text-xl font-bold">Accra</h4>
                      <p className="mt-1 text-[#3B2719] font-semibold">GHS 3,652</p>
                    </div>
                  </article>

                  <article className="bg-white rounded-2xl overflow-hidden shadow">
                    <div className="relative h-48">
                      <img src={ImgKumasi} alt="Kumasi" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4">
                      <h4 className="text-xl font-bold">Kumasi</h4>
                      <p className="mt-1 text-[#3B2719] font-semibold">GHS 343</p>
                    </div>
                  </article>

                  <article className="bg-white rounded-2xl overflow-hidden shadow">
                    <div className="relative h-48">
                      <img src={ImgTakoradi} alt="Takoradi" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4">
                      <h4 className="text-xl font-bold">Takoradi</h4>
                      <p className="mt-1 text-[#3B2719] font-semibold">GHS 350</p>
                    </div>
                  </article>
                </>
              )
            }
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-black/10 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={Logo} alt="Gida" className="h-6 w-6 object-contain" />
            <span className="font-bold">Gida</span>
          </div>
          <p className="text-sm opacity-70">© {new Date().getFullYear()} Gida. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
