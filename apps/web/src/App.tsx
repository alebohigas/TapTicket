import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { ClaimPage } from "./pages/ClaimPage";
import { TicketPage } from "./pages/TicketPage";

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/tap/:storeCode/:slug" element={<ClaimPage />} />
      <Route path="/t/:slug" element={<ClaimPage />} />
      <Route path="/r/:token" element={<TicketPage />} />
      <Route path="/ticket/:token" element={<TicketPage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
