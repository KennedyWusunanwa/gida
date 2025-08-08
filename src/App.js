import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Public pages
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";

// User dashboard pages
import DashboardLayout from "./layouts/DashboardLayout";
import MyListings from "./pages/MyListings";
import AddListing from "./pages/AddListing";
import Saved from "./pages/Saved";
import Inbox from "./pages/Inbox";
import EditProfile from "./pages/EditProfile";
import Protected from "./components/Protected";

// Admin dashboard pages
import AdminLayout from "./admin/AdminLayout";
import AdminOverview from "./admin/Overview";   // ✅ Ensure correct path
import AdminUsers from "./admin/Users";         // ✅ Ensure correct path
import AdminListings from "./admin/Listings";   // ✅ Ensure correct path
import AdminSignIn from "./admin/AdminSignIn";  // ✅ Ensure correct path
import AdminProtected from "./components/AdminProtected";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/listings/:id" element={<ListingDetail />} />

        {/* ADMIN SIGN-IN */}
        <Route path="/admin/signin" element={<AdminSignIn />} />

        {/* USER DASHBOARD */}
        <Route element={<Protected />}>
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<Navigate to="my-listings" replace />} />
            <Route path="my-listings" element={<MyListings />} />
            <Route path="add-listing" element={<AddListing />} />
            <Route path="saved" element={<Saved />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="edit-profile" element={<EditProfile />} />
          </Route>
        </Route>

        {/* ADMIN DASHBOARD */}
        <Route element={<AdminProtected />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="listings" element={<AdminListings />} />
          </Route>
        </Route>

        {/* CATCH-ALL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
