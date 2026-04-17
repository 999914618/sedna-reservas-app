import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { createClient } from "@supabase/supabase-js";
import {
  Calendar as CalendarIcon,
  Phone,
  CreditCard,
  Clock,
  Home,
  CheckCircle,
  XCircle,
  Plus,
  MessageSquare,
  Search,
  Trash2,
  Mic,
  AlertTriangle,
  RotateCcw,
  Layers,
  MapPin,
  Hotel,
  Filter,
  X,
  Archive,
  ClipboardList,
  Pencil,
  Save,
  Building2,
  RefreshCcw,
  ChevronDown
} from "lucide-react";

const ROOM_PRICES = { Single: 222.0, Casal: 302.0, Triplo: 382.0, Quadruplo: 462.0, Outros: 0.0 };
const AUTO_ARCHIVE_STATUS = ["arrived", "no_show", "cancelled", "completed"];
const ROOM_STATUS_META = {
  free: { label: "Livre", color: "bg-emerald-600" },
  reserved: { label: "Reservado", color: "bg-purple-600" },
  occupied: { label: "Ocupado", color: "bg-blue-600" },
  maintenance: { label: "Manutencao", color: "bg-yellow-500 text-black" },
  dirty: { label: "Sujo", color: "bg-amber-800" },
  disabled: { label: "Desativado", color: "bg-red-600" }
};
const ROOM_STATUS_DOT = {
  free: "bg-emerald-600",
  reserved: "bg-purple-600",
  occupied: "bg-blue-600",
  maintenance: "bg-yellow-500",
  dirty: "bg-amber-800",
  disabled: "bg-red-600"
};

const ROOM_LAYOUT = {
  "Andar 1": [
    { apt: "101", type: "2S" }, { apt: "102", type: "C" }, { apt: "103", type: "C+S" }, { apt: "104", type: "C" }, { apt: "105", type: "C+S" },
    { apt: "106", type: "C+S" }, { apt: "107", type: "C" }, { apt: "108", type: "C" }, { apt: "109", type: "LX" }, { apt: "110", type: "LX" },
    { apt: "111", type: "C" }, { apt: "112", type: "C" }, { apt: "113", type: "C" }, { apt: "114", type: "C" }, { apt: "115", type: "C+S" },
    { apt: "116", type: "C" }, { apt: "117", type: "C+S" }
  ],
  "Andar 2": [
    { apt: "201", type: "C+S" }, { apt: "202", type: "2S" }, { apt: "203", type: "C" }, { apt: "204", type: "C" }, { apt: "205", type: "C" },
    { apt: "206", type: "C" }, { apt: "207", type: "C+S" }, { apt: "208", type: "C+S" }, { apt: "209", type: "LX" }, { apt: "210", type: "LX" },
    { apt: "211", type: "C+S" }, { apt: "212", type: "3S" }, { apt: "213", type: "C+2S" }, { apt: "214", type: "C+S" }, { apt: "215", type: "C+S" },
    { apt: "216", type: "C+S" }, { apt: "217", type: "C" }, { apt: "218", type: "2S" }, { apt: "219", type: "C+S" }, { apt: "220", type: "C+S" },
    { apt: "221", type: "C+S" }, { apt: "222", type: "C+S" }, { apt: "223", type: "LX" }, { apt: "224", type: "LX" }, { apt: "225", type: "2S" },
    { apt: "226", type: "3S" }, { apt: "227", type: "C+2S" }, { apt: "228", type: "C" }
  ]
};

const ALL_ROOMS = Object.values(ROOM_LAYOUT).flat();
const SUPABASE_URL = "https://nsjafqikhuamcqutqfzr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_J6u565U6M74qlfmVYP4cSQ_lkGUJ98O";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const mapReservaFromDb = (row) => ({
  ...row,
  apt: row.room_number ?? row.apt ?? "",
  roomType: row.room_type ?? row.roomType ?? "",
  price: row.value ?? row.price ?? 0,
  checkIn: row.checkIn ?? row.check_in ?? "",
  checkOut: row.checkOut ?? row.check_out ?? "",
  statusChangedAt: row.statusChangedAt ?? row.status_changed_at ?? null,
  createdAtIso: row.createdAtIso ?? row.created_at_iso ?? null
});
const mapReservaToDb = (booking) => ({
  name: booking.name || "",
  cpf: booking.cpf || "",
  phone: booking.phone || "",
  room_number: booking.apt || booking.room_number || "",
  room_type: booking.roomType || booking.room_type || "",
  value: Number(booking.price ?? booking.value ?? 0),
  checkIn: booking.checkIn || booking.check_in || "",
  checkOut: booking.checkOut || booking.check_out || "",
  noCheckOutInfo: Boolean(booking.noCheckOutInfo),
  customRoomName: booking.customRoomName || "",
  arrivalTime: booking.arrivalTime || "",
  status: booking.status || "confirmed",
  createdAtIso: booking.createdAtIso || new Date().toISOString(),
  statusChangedAt: booking.statusChangedAt || new Date().toISOString(),
  archivedAt: booking.archivedAt ?? null,
  completedAt: booking.completedAt ?? null
});

const getMTDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const getMTTime = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Cuiaba", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const normalizeText = (v) => (v || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const normalizeDigits = (v) => (v || "").toString().replace(/\D/g, "");
const dateToNumber = (d) => Number((d || "").replace(/-/g, ""));
const rangesOverlap = (startA, endA, startB, endB) => startA <= endB && startB <= endA;
const formatBrDate = (date) => (date || "").split("-").reverse().join("/");

const firebaseConfigRaw = typeof window !== "undefined" ? window.__firebase_config : undefined;
const appId = typeof window !== "undefined" && window.__app_id ? window.__app_id : "sedna-palace-app";
const initialAuthToken = typeof window !== "undefined" ? window.__initial_auth_token : undefined;
const firebaseConfig = firebaseConfigRaw ? JSON.parse(firebaseConfigRaw) : null;
const firebaseApp = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [allBookings, setAllBookings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [readMessages, setReadMessages] = useState([]);
  const [roomStatuses, setRoomStatuses] = useState({});
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [currentTime, setCurrentTime] = useState(getMTTime());
  const [selectedArchiveIds, setSelectedArchiveIds] = useState([]);

  const todayString = useMemo(() => getMTDate(), []);
  const deviceId = useMemo(() => {
    let id = localStorage.getItem("sedna_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("sedna_device_id", id);
    }
    return id;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getMTTime()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!auth) return void setUser({ uid: "local-user" });
    const initAuth = async () => {
      try {
        if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
        else await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const loadAllBookings = async () => {
    const { data, error } = await supabase.from("reservas").select("*");
    if (error) {
      console.error("Erro ao carregar todas as reservas do Supabase", error);
      return;
    }
    setAllBookings(Array.isArray(data) ? data.map(mapReservaFromDb) : []);
  };

  const loadBookingsForView = async () => {
    let query = supabase.from("reservas").select("*");
    if (activeTab === "dashboard" || activeTab === "all_bookings") query = query.eq("status", "confirmed");
    if (activeTab === "checkin") query = query.eq("status", "arrived");
    if (activeTab === "noshow") query = query.eq("status", "no_show");
    if (activeTab === "cancelled") query = query.eq("status", "cancelled");
    if (activeTab === "history") query = query.eq("status", "archived");
    const { data, error } = await query;
    if (error) {
      console.error("Erro ao carregar reservas filtradas do Supabase", error);
      return;
    }
    setBookings(Array.isArray(data) ? data.map(mapReservaFromDb) : []);
  };

  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase.from("mural_recados").select("*");
      if (error) {
        console.error("Erro ao carregar mural de recados do Supabase", error);
        return;
      }
      setMessages(Array.isArray(data) ? data : []);
    };

    loadMessages();
    const channel = supabase
      .channel("mural-recados-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "mural_recados" }, () => {
        loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadRoomStatuses = async () => {
      const { data, error } = await supabase.from("status_quartos").select("*");
      if (error) {
        console.error("Erro ao carregar status dos quartos do Supabase", error);
        return;
      }
      const map = {};
      (data || []).forEach((row) => {
        const roomNumber = row.room_number ?? row.apt;
        if (roomNumber) map[roomNumber] = row.status || "free";
      });
      setRoomStatuses(map);
    };

    loadRoomStatuses();
    const channel = supabase
      .channel("status-quartos-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "status_quartos" }, () => {
        loadRoomStatuses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadAllBookings();
    loadBookingsForView();
    const channel = supabase
      .channel("reservas-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => {
        loadAllBookings();
        loadBookingsForView();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      const due = allBookings.filter((b) => AUTO_ARCHIVE_STATUS.includes(b.status) && b.statusChangedAt && now - new Date(b.statusChangedAt).getTime() >= 12 * 60 * 60 * 1000);
      for (const b of due) {
        // eslint-disable-next-line no-await-in-loop
        await supabase.from("reservas").update({ status: "archived", archivedAt: new Date().toISOString() }).eq("id", b.id);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [allBookings]);

  const getRoomStatus = (apt) => roomStatuses[apt] || "free";

  const getPanelRoomState = (apt) => {
    const manualStatus = getRoomStatus(apt);
    const todayNum = dateToNumber(getMTDate());

    if (["maintenance", "disabled", "dirty"].includes(manualStatus)) {
      return { status: manualStatus, untilDate: null };
    }

    const roomBookings = allBookings.filter((b) => (b.apt || "").trim() === (apt || "").trim() && !["archived", "cancelled", "no_show"].includes(b.status));

    const arrivedActive = roomBookings.find((b) => {
      if (b.status !== "arrived") return false;
      if (!b.checkOut) return true;
      return todayNum <= dateToNumber(b.checkOut);
    });
    if (arrivedActive) return { status: "occupied", untilDate: arrivedActive.checkOut || null };

    const shouldBeDirty = roomBookings.find((b) => b.status === "arrived" && b.checkOut && todayNum > dateToNumber(b.checkOut));
    if (shouldBeDirty) return { status: "dirty", untilDate: null };

    const confirmedForToday = roomBookings.find((b) => {
      if (b.status !== "confirmed") return false;
      const start = dateToNumber(b.checkIn);
      const end = dateToNumber(b.checkOut || b.checkIn);
      return todayNum >= start && todayNum <= end;
    });
    if (confirmedForToday) return { status: "reserved", untilDate: confirmedForToday.checkOut || confirmedForToday.checkIn };

    return { status: manualStatus, untilDate: null };
  };

  const bookingConflict = (candidate, ignoreId = null) => {
    const apt = candidate.apt;
    if (!apt || !candidate.checkIn) return null;
    const startA = dateToNumber(candidate.checkIn);
    const endA = dateToNumber(candidate.checkOut || candidate.checkIn);
    return allBookings.find((b) => {
      if (b.id === ignoreId) return false;
      if (b.status === "archived" || b.status === "cancelled") return false;
      if ((b.apt || "").trim() !== apt.trim()) return false;
      const startB = dateToNumber(b.checkIn);
      const endB = dateToNumber(b.checkOut || b.checkIn);
      return rangesOverlap(startA, endA, startB, endB);
    });
  };

  const updateRoomStatus = async (apt, status) => {
    const { error } = await supabase.from("status_quartos").upsert({ room_number: apt, status }, { onConflict: "room_number" });
    if (error) {
      console.error("Erro ao atualizar status do quarto no Supabase", error);
      alert("Nao foi possivel atualizar o status do quarto.");
    }
  };

  const createBooking = async (formData) => {
    if (!user) return;
    const roomStatus = getPanelRoomState(formData.apt).status;
    if (["occupied", "dirty", "maintenance", "disabled", "reserved"].includes(roomStatus) && formData.checkIn === getMTDate()) {
      const label = ROOM_STATUS_META[roomStatus].label.toLowerCase();
      const msg = roomStatus === "maintenance" ? `⚠️ Quarto ${formData.apt} está em manutenção.` : `⚠️ Quarto ${formData.apt} está ${label}.`;
      alert(msg);
      return;
    }
    const conflict = bookingConflict(formData);
    if (conflict) {
      alert("⚠️ Já existe uma reserva cadastrada para este apartamento nesta data.");
      return;
    }
    const payload = mapReservaToDb({
      ...formData,
      status: "confirmed",
      createdAtIso: new Date().toISOString(),
      statusChangedAt: new Date().toISOString()
    });
    const { error } = await supabase.from("reservas").insert(payload);
    if (error) {
      console.error("Erro ao criar reserva no Supabase", error);
      alert("Nao foi possivel salvar a reserva no Supabase.");
      return;
    }
    setShowNewBooking(false);
  };

  const updateBookingStatus = async (id, status) => {
    const isCheckoutToHistory = status === "completed";
    const payload = isCheckoutToHistory
      ? { status: "archived", statusChangedAt: new Date().toISOString(), archivedAt: new Date().toISOString(), completedAt: new Date().toISOString() }
      : { status, statusChangedAt: new Date().toISOString() };
    const current = allBookings.find((b) => b.id === id);
    const { error } = await supabase.from("reservas").update(payload).eq("id", id);
    if (error) {
      console.error("Erro ao atualizar reserva no Supabase", error);
      alert("Nao foi possivel atualizar a reserva no Supabase.");
      return;
    }
    if (current?.apt) {
      if (status === "arrived") await updateRoomStatus(current.apt, "occupied");
      if (status === "cancelled") await updateRoomStatus(current.apt, "free");
      if (status === "completed") await updateRoomStatus(current.apt, "dirty");
    }
  };

  const archiveBooking = async (id) => {
    const { error } = await supabase.from("reservas").update({ status: "archived", archivedAt: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error("Erro ao arquivar reserva no Supabase", error);
      alert("Nao foi possivel arquivar a reserva no Supabase.");
    }
  };

  const restoreBooking = async (id) => updateBookingStatus(id, "confirmed");
  const deleteBooking = async (id) => {
    const { error } = await supabase.from("reservas").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir reserva no Supabase", error);
      alert("Nao foi possivel excluir a reserva no Supabase.");
    }
  };

  const deleteSelectedArchived = async () => {
    for (const id of selectedArchiveIds) {
      // eslint-disable-next-line no-await-in-loop
      await deleteBooking(id);
    }
    setSelectedArchiveIds([]);
  };

  const startCancellation = (id) => {
    setCancellingId(id);
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          updateBookingStatus(id, "cancelled");
          setCancellingId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const applySearch = () => setSearchTerm(searchInput.trim());
  const clearSearch = () => { setSearchInput(""); setSearchTerm(""); };
  const markAsRead = async (msgId) => setReadMessages((prev) => (prev.includes(msgId) ? prev : [...prev, msgId]));

  const addMessage = async (data) => {
    if (!data?.content?.trim()) return;
    const payload = { content: data.content.trim(), type: "text", senderId: deviceId, timestamp: new Date().toISOString(), displayTime: `${getMTDate()} ${getMTTime()}`, targetType: data.targetType || "all", targetName: data.targetType === "person" ? (data.targetName || "").trim() : "" };
    const { error } = await supabase.from("mural_recados").insert(payload);
    if (error) {
      console.error("Erro ao criar recado no Supabase", error);
      alert("Nao foi possivel criar o recado.");
    }
  };
  const updateMessage = async (id, updates) => {
    const { error } = await supabase.from("mural_recados").update({ ...updates, editedAt: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error("Erro ao atualizar recado no Supabase", error);
      alert("Nao foi possivel atualizar o recado.");
    }
  };
  const deleteMessage = async (id) => {
    const { error } = await supabase.from("mural_recados").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir recado no Supabase", error);
      alert("Nao foi possivel excluir o recado.");
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const search = normalizeText(searchTerm);
      const matchSearch = !searchTerm || normalizeText(b.name).includes(search) || normalizeDigits(b.cpf).includes(normalizeDigits(searchTerm)) || normalizeText(b.checkIn).includes(search);
      if (filterDate && b.checkIn !== filterDate) return false;
      if (activeTab === "dashboard") return ((!filterDate && !searchTerm) ? b.checkIn === todayString : true) && matchSearch;
      return matchSearch;
    });
  }, [bookings, activeTab, searchTerm, filterDate, todayString]);

  const unreadCount = messages.filter((m) => !readMessages.includes(m.id)).length;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-neutral-950 border-r border-neutral-800 p-6 flex flex-col shrink-0 z-20">
        <div className="mb-10 flex items-center gap-3">
          <div className="bg-[#D4AF37] p-2 rounded-lg"><Hotel size={24} className="text-black" /></div>
          <div><h2 className="text-[#D4AF37] font-serif text-sm md:text-base font-bold tracking-wide leading-tight">SEDNA PALACE HOTEL- RESERVAS</h2><span className="text-[10px] uppercase tracking-widest opacity-50 block">Painel de Gestao</span></div>
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<Clock size={20} />} label="Reservas do Dia" />
          <NavItem active={activeTab === "all_bookings"} onClick={() => setActiveTab("all_bookings")} icon={<Layers size={20} />} label="Todas as Reservas" />
          <NavItem active={activeTab === "checkin"} onClick={() => setActiveTab("checkin")} icon={<CheckCircle size={20} />} label="Check-in Realizado" />
          <NavItem active={activeTab === "noshow"} onClick={() => setActiveTab("noshow")} icon={<AlertTriangle size={20} />} label="Nao Compareceu" />
          <NavItem active={activeTab === "cancelled"} onClick={() => setActiveTab("cancelled")} icon={<Trash2 size={20} />} label="Canceladas" />
          <NavItem active={activeTab === "history"} onClick={() => setActiveTab("history")} icon={<ClipboardList size={20} />} label="Historico" />
          <NavItem active={activeTab === "room_panel"} onClick={() => setActiveTab("room_panel")} icon={<Building2 size={20} />} label="Status dos Quartos" />
          <NavItem active={activeTab === "messages"} onClick={() => setActiveTab("messages")} icon={<MessageSquare size={20} />} label="Mural de Recados" badge={unreadCount > 0 ? unreadCount : null} />
        </nav>
        <div className="mt-auto pt-6 border-t border-neutral-800"><div className="flex items-center gap-2 text-[10px] text-[#D4AF37]/60"><MapPin size={12} /> <span>Guaranta do Norte - MT</span></div></div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-24 md:h-20 border-b border-neutral-800 flex flex-col md:flex-row items-center justify-between px-8 bg-black gap-4 py-4 md:py-0">
          <div className="flex items-center gap-3 flex-1 w-full max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input type="text" placeholder="Buscar por nome, CPF ou data..." className="w-full bg-neutral-900 border border-neutral-800 rounded-full py-2 pl-10 pr-4 focus:border-[#D4AF37] outline-none transition-all text-sm" value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setSearchTerm(e.target.value.trim()); }} onKeyDown={(e) => e.key === "Enter" && applySearch()} />
            </div>
            <button onClick={applySearch} className="bg-[#D4AF37] text-black px-4 py-2 rounded-full text-xs font-bold">Pesquisar</button>
            <div className="relative flex items-center bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2"><CalendarIcon size={16} className={filterDate ? "text-[#D4AF37]" : "text-neutral-500"} /><input type="date" className="bg-transparent border-none outline-none text-xs ml-2 text-white w-28" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />{filterDate && <button onClick={() => setFilterDate("")} className="ml-2 text-red-500"><X size={14} /></button>}</div>
          </div>
          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
            <div className="flex flex-col items-end"><span className="text-[#D4AF37] font-mono text-lg font-bold leading-none">{currentTime}</span><span className="text-[9px] text-neutral-500 uppercase">MT TIME</span></div>
            {activeTab !== "room_panel" && activeTab !== "messages" && <button onClick={() => setShowNewBooking(true)} className="flex items-center gap-2 bg-[#D4AF37] text-black px-6 py-2 rounded-full font-bold"><Plus size={20} /> Nova Reserva</button>}
          </div>
        </header>
        <section className="flex-1 overflow-y-auto p-8">
          {activeTab === "messages" && <MessageSection messages={messages} readMessages={readMessages} onRead={markAsRead} onAdd={addMessage} onEdit={updateMessage} onDelete={deleteMessage} deviceId={deviceId} />}
          {activeTab === "room_panel" && <RoomPanel getPanelRoomState={getPanelRoomState} onStatusChange={updateRoomStatus} />}
          {activeTab !== "messages" && activeTab !== "room_panel" && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-serif text-[#D4AF37]">{activeTab === "dashboard" ? "RESERVAS DE HOJE" : activeTab === "all_bookings" ? "TODAS AS RESERVAS" : activeTab === "checkin" ? "CHECK-IN REALIZADO" : activeTab === "noshow" ? "NAO COMPARECEU" : activeTab === "cancelled" ? "RESERVAS CANCELADAS" : "HISTORICO DE RESERVAS"}</h1>
                  {searchTerm && <div className="text-xs text-neutral-500 mt-1">Filtrando por "{searchTerm}" <button onClick={clearSearch} className="text-red-400 ml-2">Limpar</button></div>}
                </div>
                {activeTab === "history" && <div className="flex items-center gap-2"><span className="text-xs text-neutral-400">Selecionadas: {selectedArchiveIds.length}</span><button onClick={deleteSelectedArchived} disabled={!selectedArchiveIds.length} className="px-4 py-2 rounded-lg text-xs font-bold border border-red-500/40 text-red-400 disabled:opacity-40">Excluir em lote</button></div>}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                {filteredBookings.length > 0 ? filteredBookings.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onStatusUpdate={updateBookingStatus}
                    onDelete={deleteBooking}
                    onArchive={archiveBooking}
                    onRestore={restoreBooking}
                    isCancelling={cancellingId === b.id}
                    countdown={countdown}
                    onCancelStart={() => startCancellation(b.id)}
                    onUndoCancel={() => { setCancellingId(null); setCountdown(0); }}
                    isArchiveView={activeTab === "history"}
                    isCancelledView={activeTab === "cancelled"}
                    isSelected={selectedArchiveIds.includes(b.id)}
                    onToggleSelect={(id) => setSelectedArchiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
                    roomStatus={getPanelRoomState(b.apt).status}
                  />
                )) : <div className="col-span-full py-20 text-center opacity-30 italic"><Hotel size={40} className="mx-auto mb-3" />Nenhuma reserva encontrada.</div>}
              </div>
            </>
          )}
        </section>
      </main>
      {showNewBooking && <BookingModal onClose={() => setShowNewBooking(false)} onSave={createBooking} bookings={bookings} roomStatuses={roomStatuses} />}
    </div>
  );
}

function NavItem({ active, onClick, icon, label, badge }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-xl ${active ? "bg-[#D4AF37] text-black font-bold" : "text-white/60 hover:bg-neutral-800 hover:text-white"}`}>{icon}<span className="flex-1 text-left text-sm">{label}</span>{badge && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">{badge}</span>}</button>;
}

function BookingCard({ booking, onStatusUpdate, onDelete, onArchive, onRestore, isCancelling, countdown, onCancelStart, onUndoCancel, isArchiveView, isCancelledView, isSelected, onToggleSelect, roomStatus }) {
  const canArchive = ["arrived", "no_show", "cancelled"].includes(booking.status) && !isArchiveView;
  const changedAgoHours = booking.statusChangedAt ? ((Date.now() - new Date(booking.statusChangedAt).getTime()) / 3600000).toFixed(1) : null;
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-[#D4AF37]/50 relative">
      {isArchiveView && <label className="absolute right-4 top-4 text-xs text-neutral-400"><input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(booking.id)} className="mr-2" />Selecionar</label>}
      <div className="flex justify-between items-start mb-4">
        <div><h3 className="text-xl font-bold uppercase">{booking.name}</h3><p className="text-[#D4AF37] text-sm flex items-center gap-1"><Home size={14} /> Apt {booking.apt || "---"} | {booking.customRoomName || booking.roomType}</p></div>
        <div className="text-right"><p className="text-[9px] text-neutral-500 uppercase">Check-in</p><p className="font-mono text-[#D4AF37] text-sm">{(booking.checkIn || "").split("-").reverse().join("/")}</p></div>
      </div>
      <div className="space-y-2 mb-4 text-sm text-neutral-300">
        <p className="flex items-center gap-2"><CreditCard size={14} /> CPF: {booking.cpf || "Nao informado"}</p>
        <p className="flex items-center gap-2"><Phone size={14} /> {booking.phone}</p>
        <p className="flex items-center gap-2"><Clock size={14} /> Previsto: {booking.arrivalTime || "--:--"}</p>
        <p className="text-xs">Status quarto: <span className="text-[#D4AF37]">{ROOM_STATUS_META[roomStatus]?.label || "Livre"}</span></p>
        {AUTO_ARCHIVE_STATUS.includes(booking.status) && !isArchiveView && changedAgoHours && <p className="text-xs text-neutral-500">Arquivamento automatico em 12h (decorrido: {changedAgoHours}h)</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {booking.status === "confirmed" && !isCancelling && <>
          <button onClick={() => onStatusUpdate(booking.id, "arrived")} className="bg-emerald-600 py-2 rounded-lg text-xs font-bold">CHEGOU</button>
          <button onClick={onCancelStart} className="bg-red-600 py-2 rounded-lg text-xs font-bold">CANCELAR</button>
          <button onClick={() => onStatusUpdate(booking.id, "no_show")} className="col-span-2 border border-red-500/50 text-red-400 py-2 rounded-lg text-xs font-bold">HOSPEDE NAO VEIO</button>
        </>}
        {booking.status === "arrived" && (
          <button onClick={() => onStatusUpdate(booking.id, "completed")} className="col-span-2 border border-amber-500/60 text-amber-300 py-2 rounded-lg text-xs font-bold">
            CHECK-OUT REALIZADO (MARCAR SUJO)
          </button>
        )}
        {isCancelling && <div className="col-span-2 bg-red-600/10 p-4 rounded-lg text-center"><p className="text-red-400 text-sm">Movendo para canceladas em {countdown}s...</p><button onClick={onUndoCancel} className="mt-2 text-xs bg-neutral-700 px-3 py-1 rounded-full flex items-center gap-1 mx-auto"><RotateCcw size={12} />Desfazer</button></div>}
        {canArchive && <button onClick={() => onArchive(booking.id)} className="col-span-2 border border-[#D4AF37]/40 text-[#D4AF37] py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"><Archive size={14} />ARQUIVAR RESERVA</button>}
        {isCancelledView && <button onClick={() => onRestore(booking.id)} className="col-span-2 border border-emerald-500/60 text-emerald-400 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"><RefreshCcw size={14} />RESTAURAR RESERVA</button>}
        {isArchiveView && <button onClick={() => confirm("Excluir permanentemente?") && onDelete(booking.id)} className="col-span-2 border border-red-500/50 text-red-400 py-2 rounded-lg text-xs font-bold">EXCLUIR DEFINITIVAMENTE</button>}
      </div>
    </div>
  );
}

function BookingModal({ onClose, onSave, bookings, roomStatuses }) {
  const [form, setForm] = useState({ name: "", cpf: "", phone: "", roomType: "Casal", customRoomName: "", price: ROOM_PRICES.Casal, checkIn: getMTDate(), checkOut: "", noCheckOutInfo: false, apt: "", arrivalTime: "" });
  const [warning, setWarning] = useState("");
  const handleRoomChange = (type) => setForm((prev) => ({ ...prev, roomType: type, price: ROOM_PRICES[type] || 0, customRoomName: "" }));
  useEffect(() => {
    if (!form.apt) return setWarning("");
    const status = roomStatuses[form.apt] || "free";
    if (status !== "free") {
      if (status === "occupied") setWarning(`⚠️ Quarto ${form.apt} está ocupado.`);
      else if (status === "dirty") setWarning(`⚠️ Quarto ${form.apt} precisa de limpeza.`);
      else if (status === "maintenance") setWarning(`⚠️ Quarto ${form.apt} está em manutenção.`);
      else if (status === "disabled") setWarning(`⚠️ Quarto ${form.apt} está desativado.`);
      return;
    }
    const startA = dateToNumber(form.checkIn);
    const endA = dateToNumber(form.noCheckOutInfo ? form.checkIn : (form.checkOut || form.checkIn));
    const conflict = bookings.some((b) => {
      if ((b.apt || "") !== form.apt) return false;
      if (b.status === "cancelled" || b.status === "archived") return false;
      const startB = dateToNumber(b.checkIn);
      const endB = dateToNumber(b.checkOut || b.checkIn);
      return rangesOverlap(startA, endA, startB, endB);
    });
    setWarning(conflict ? "⚠️ Já existe uma reserva cadastrada para este apartamento nesta data." : "");
  }, [form, bookings, roomStatuses]);
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-neutral-900 border border-[#D4AF37] w-full max-w-3xl rounded-3xl p-8">
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-serif text-[#D4AF37] uppercase">Nova Reserva</h2><button onClick={onClose} className="text-white/60"><XCircle size={30} /></button></div>
        <form onSubmit={(e) => { e.preventDefault(); if (warning) return alert(warning); onSave({ ...form, checkOut: form.noCheckOutInfo ? "" : form.checkOut }); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input required placeholder="Nome do Hospede" className="md:col-span-2 bg-black border border-neutral-800 p-3 rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="CPF" className="bg-black border border-neutral-800 p-3 rounded-xl" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          <input required placeholder="Telefone" className="bg-black border border-neutral-800 p-3 rounded-xl" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="bg-black border border-neutral-800 p-3 rounded-xl" value={form.roomType} onChange={(e) => handleRoomChange(e.target.value)}>{Object.keys(ROOM_PRICES).map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <input type="number" step="0.01" className="bg-black border border-neutral-800 p-3 rounded-xl" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <select required className="md:col-span-2 bg-black border border-neutral-800 p-3 rounded-xl" value={form.apt} onChange={(e) => setForm({ ...form, apt: e.target.value })}>
            <option value="">Selecione o apartamento</option>
            {ALL_ROOMS.map((r) => <option key={r.apt} value={r.apt}>{r.apt} {r.type}</option>)}
          </select>
          <input required type="date" className="bg-black border border-neutral-800 p-3 rounded-xl" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          <input type="date" required={!form.noCheckOutInfo} disabled={form.noCheckOutInfo} className="bg-black border border-neutral-800 p-3 rounded-xl disabled:opacity-40" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          <label className="md:col-span-2 text-xs text-neutral-400"><input type="checkbox" className="mr-2" checked={form.noCheckOutInfo} onChange={(e) => setForm({ ...form, noCheckOutInfo: e.target.checked, checkOut: e.target.checked ? "" : form.checkOut })} />Nao informou a data de saida</label>
          {warning && <p className="md:col-span-2 text-sm text-yellow-300 bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3">{warning}</p>}
          <button className="md:col-span-2 bg-[#D4AF37] text-black font-bold p-4 rounded-2xl uppercase">Finalizar Cadastro</button>
        </form>
      </div>
    </div>
  );
}

function RoomPanel({ onStatusChange, getPanelRoomState }) {
  const [openMenuRoom, setOpenMenuRoom] = useState(null);
  const statusSummary = useMemo(() => {
    const summary = {
      free: 0,
      reserved: 0,
      occupied: 0,
      maintenance: 0,
      dirty: 0,
      disabled: 0
    };
    ALL_ROOMS.forEach((room) => {
      const status = getPanelRoomState(room.apt).status;
      if (summary[status] !== undefined) summary[status] += 1;
    });
    return summary;
  }, [getPanelRoomState]);

  const handleSelectStatus = async (apt, status) => {
    await onStatusChange(apt, status);
    setOpenMenuRoom(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-[#D4AF37]">Status dos Quartos</h1>
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm md:text-base font-bold text-white">Resumo da Ocupacao</h2>
          <span className="text-xs md:text-sm text-neutral-300">Total de Quartos: {ALL_ROOMS.length}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <SummaryCard label="Livre" value={statusSummary.free} chipClass="bg-emerald-600" />
          <SummaryCard label="Reservado" value={statusSummary.reserved} chipClass="bg-purple-600" />
          <SummaryCard label="Ocupado" value={statusSummary.occupied} chipClass="bg-blue-600" />
          <SummaryCard label="Manutencao" value={statusSummary.maintenance} chipClass="bg-yellow-500 text-black" />
          <SummaryCard label="Sujo" value={statusSummary.dirty} chipClass="bg-amber-800" />
          <SummaryCard label="Desativado" value={statusSummary.disabled} chipClass="bg-red-600" />
        </div>
      </div>
      {Object.entries(ROOM_LAYOUT).map(([floor, rooms]) => (
        <div key={floor}>
          <h2 className="text-lg font-bold mb-3">{floor}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {rooms.map((room) => {
              const panelState = getPanelRoomState(room.apt);
              const status = panelState.status;
              const isOpen = openMenuRoom === room.apt;
              return (
                <div key={room.apt} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-left hover:border-[#D4AF37]/50 relative">
                  <div className="font-bold">{room.apt} {room.type}</div>
                  <button
                    onClick={() => setOpenMenuRoom((prev) => (prev === room.apt ? null : room.apt))}
                    className={`text-xs mt-2 px-2 py-1 rounded-full inline-flex items-center gap-1 ${ROOM_STATUS_META[status].color}`}
                  >
                    {ROOM_STATUS_META[status].label}
                    <ChevronDown size={12} />
                  </button>
                  {(status === "reserved" || status === "occupied") && (
                    <p className="text-[10px] text-neutral-300 mt-2">
                      {status === "reserved" ? "Reservado" : "Ocupado"} {panelState.untilDate ? `até ${formatBrDate(panelState.untilDate)}` : ""}
                    </p>
                  )}

                  {isOpen && (
                    <div className="absolute z-20 left-3 right-3 top-[68px] bg-black border border-neutral-700 rounded-lg overflow-hidden shadow-xl">
                      {Object.entries(ROOM_STATUS_META).filter(([key]) => key !== "reserved").map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => handleSelectStatus(room.apt, key)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 flex items-center justify-between"
                        >
                          <span>{value.label}</span>
                          <span className={`w-3 h-3 rounded-full inline-block ${ROOM_STATUS_DOT[key]}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, chipClass }) {
  return (
    <div className="bg-black/40 border border-neutral-800 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] md:text-xs px-2 py-1 rounded-full ${chipClass}`}>{label}</span>
        <span className="text-xl md:text-2xl font-extrabold text-white leading-none">{value}</span>
      </div>
    </div>
  );
}

function MessageSection({ messages, readMessages, onRead, onAdd, onEdit, onDelete, deviceId }) {
  const [msgInput, setMsgInput] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetName, setTargetName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editTargetType, setEditTargetType] = useState("all");
  const [editTargetName, setEditTargetName] = useState("");
  const sortedMessages = useMemo(() => [...messages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), [messages]);
  const submitMessage = () => { onAdd({ content: msgInput, targetType, targetName }); setMsgInput(""); setTargetType("all"); setTargetName(""); };
  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
      <div className="p-6 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between"><h2 className="text-[#D4AF37] font-serif text-xl uppercase">Recados da Equipe</h2><div className="text-[9px] text-neutral-500 border border-neutral-800 px-2 py-1 rounded-full">ID: {deviceId.substring(0, 8)}</div></div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[500px]">
        {sortedMessages.map((msg) => {
          const isEditing = editingId === msg.id;
          return (
            <div key={msg.id} className={`p-4 rounded-xl border ${readMessages.includes(msg.id) ? "bg-black/50 border-neutral-800 opacity-50" : "bg-neutral-800 border-[#D4AF37]/50"}`} onMouseEnter={() => !readMessages.includes(msg.id) && onRead(msg.id)}>
              <div className="flex justify-between items-start mb-2"><span className="text-[10px] text-[#D4AF37] font-bold">{msg.displayTime || new Date(msg.timestamp).toLocaleString()}</span><div className="flex gap-2 text-xs"><button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); setEditTargetType(msg.targetType || "all"); setEditTargetName(msg.targetName || ""); }} className="text-blue-300 flex items-center gap-1"><Pencil size={12} />Editar</button><button onClick={() => confirm("Excluir recado?") && onDelete(msg.id)} className="text-red-400">Excluir</button></div></div>
              <div className="text-[10px] text-neutral-400 mb-2">{msg.targetType === "person" ? `Para: ${msg.targetName}` : "Para: Todos"}</div>
              {!isEditing ? <p>{msg.content}</p> : <div className="space-y-2"><input className="w-full bg-black border border-neutral-700 rounded-lg p-2 text-sm" value={editContent} onChange={(e) => setEditContent(e.target.value)} /><div className="flex items-center gap-2 text-xs"><label><input type="radio" checked={editTargetType === "all"} onChange={() => setEditTargetType("all")} /> Todos</label><label><input type="radio" checked={editTargetType === "person"} onChange={() => setEditTargetType("person")} /> Pessoa</label>{editTargetType === "person" && <input className="bg-black border border-neutral-700 rounded p-1 text-xs" value={editTargetName} onChange={(e) => setEditTargetName(e.target.value)} placeholder="Nome" />}<button onClick={() => { onEdit(msg.id, { content: editContent, targetType: editTargetType, targetName: editTargetName }); setEditingId(null); }} className="bg-emerald-700 px-2 py-1 rounded flex items-center gap-1"><Save size={12} />Salvar</button></div></div>}
            </div>
          );
        })}
      </div>
      <div className="p-4 bg-black border-t border-neutral-800 space-y-3">
        <input className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm" placeholder="Escreva um recado..." value={msgInput} onChange={(e) => setMsgInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitMessage()} />
        <div className="flex flex-wrap items-center gap-3 text-xs"><label><input type="radio" checked={targetType === "all"} onChange={() => setTargetType("all")} /> Recado para todos</label><label><input type="radio" checked={targetType === "person"} onChange={() => setTargetType("person")} /> Recado direcionado</label>{targetType === "person" && <input className="bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-xs" placeholder="Nome da pessoa" value={targetName} onChange={(e) => setTargetName(e.target.value)} />}<button onClick={submitMessage} className="bg-[#D4AF37] text-black p-2 rounded-lg"><Plus size={18} /></button></div>
      </div>
    </div>
  );
}
