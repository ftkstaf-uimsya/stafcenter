"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CopyPlus,
  Edit3,
  ExternalLink,
  FileCheck2,
  FileText,
  KanbanSquare,
  Plus,
  ScrollText,
  Table2,
  Trash2,
} from "lucide-react";
import { useSarpras } from "@/lib/supabase/sarpras-context";
import {
  getThesisEntityType,
  getThesisHref,
  getThesisPageKey,
} from "@/lib/auth/permissions";
import { PRODI_ENUM_LIST, TODAY_ISO } from "@/lib/supabase/seed-data";
import {
  ProdiCode,
  ThesisBoardColumn,
  ThesisLetterStatus,
  ThesisStage,
  ThesisTrack,
  ThesisWorkflow,
} from "@/types/sarpras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, BadgeTone } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import {
  ColumnsTogglePopover,
  FilterPopover,
} from "@/components/ui/filter-popover";
import { KanbanBoard, KanbanColumnDef } from "@/components/ui/kanban-board";
import { EntityDrawerSections } from "@/components/ui/entity-drawer-sections";
import { ErrorStateView, LoadingStateView } from "@/components/ui/data-states";

interface TugasAkhirBoardViewProps {
  track: ThesisTrack;
  stage: ThesisStage;
}

const COLUMN_ORDER: ThesisBoardColumn[] = [
  "berkas_daftar",
  "bikin_jadwal",
  "bikin_surat",
  "selesai_arsip",
];

const COLUMN_META: Record<
  ThesisBoardColumn,
  {
    title: string;
    shortDesc: string;
    dotColorClass: string;
    badgeTone: BadgeTone;
    progressPercent: number;
    progressColorClass: string;
  }
> = {
  berkas_daftar: {
    title: "Berkas Daftar",
    shortDesc: "Verifikasi berkas & syarat masuk",
    dotColorClass: "bg-amber-500",
    badgeTone: "warning",
    progressPercent: 25,
    progressColorClass: "bg-amber-500",
  },
  bikin_jadwal: {
    title: "Bikin Jadwal",
    shortDesc: "Penetapan hari, ruang & penguji",
    dotColorClass: "bg-[#1E3A5F] dark:bg-sky-400",
    badgeTone: "info",
    progressPercent: 55,
    progressColorClass: "bg-[#1E3A5F] dark:bg-sky-400",
  },
  bikin_surat: {
    title: "Bikin Surat",
    shortDesc: "Nomor surat tugas & undangan",
    dotColorClass: "bg-emerald-600 dark:bg-emerald-400",
    badgeTone: "success",
    progressPercent: 80,
    progressColorClass: "bg-emerald-600 dark:bg-emerald-400",
  },
  selesai_arsip: {
    title: "Selesai / Arsip",
    shortDesc: "Pelaksanaan selesai & arsip berkas",
    dotColorClass: "bg-slate-500 dark:bg-slate-400",
    badgeTone: "neutral",
    progressPercent: 100,
    progressColorClass: "bg-slate-600 dark:bg-slate-400",
  },
};

const LETTER_STATUSES: ThesisLetterStatus[] = [
  "Belum Dibuat",
  "Draft",
  "Siap TTD",
  "Terbit",
];

function LetterStatusBadge({ status }: { status: ThesisLetterStatus }) {
  const toneMap: Record<ThesisLetterStatus, BadgeTone> = {
    "Belum Dibuat": "neutral",
    Draft: "warning",
    "Siap TTD": "info",
    Terbit: "success",
  };
  return <Badge tone={toneMap[status]}>{status}</Badge>;
}

function ColumnBadge({ col }: { col: ThesisBoardColumn }) {
  const meta = COLUMN_META[col];
  return <Badge tone={meta.badgeTone}>{meta.title}</Badge>;
}

function parseTimeMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const parts = hhmm.split(":").map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return parts[0] * 60 + parts[1];
}

function formatWibIso(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function TugasAkhirBoardView({
  track,
  stage,
}: TugasAkhirBoardViewProps) {
  const {
    thesisWorkflows,
    thesisWorkflowsAvailable,
    lecturers,
    rooms,
    campusOfficials,
    academicClasses,
    notes,
    attachments,
    isLiveSupabase,
    canAccessPage,
    uiSimState,
    setUiSimState,
    addThesisWorkflow,
    updateThesisWorkflow,
    moveThesisWorkflow,
    deleteThesisWorkflow,
    copyThesisToSidang,
  } = useSarpras();

  const pageKey = getThesisPageKey(track, stage);
  const entityType = getThesisEntityType(track, stage);
  const siblingStage: ThesisStage = stage === "proposal" ? "sidang" : "proposal";
  const siblingPageKey = getThesisPageKey(track, siblingStage);
  const canAccessSibling = canAccessPage(siblingPageKey);
  const canAccessSidang = canAccessPage(getThesisPageKey(track, "sidang"));

  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProdi, setFilterProdi] = useState("ALL");
  const [filterLetterStatus, setFilterLetterStatus] = useState("ALL");
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // State Modal Tambah / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ThesisWorkflow | null>(null);
  const [formColumn, setFormColumn] =
    useState<ThesisBoardColumn>("berkas_daftar");
  const [studentName, setStudentName] = useState("");
  const [studentNim, setStudentNim] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [prodi, setProdi] = useState<ProdiCode>("MPI");
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [journalName, setJournalName] = useState("");
  const [journalUrl, setJournalUrl] = useState("");
  const [supervisor1Id, setSupervisor1Id] = useState("");
  const [supervisor2Id, setSupervisor2Id] = useState("");
  const [registeredAt, setRegisteredAt] = useState(TODAY_ISO);
  const [documentNotes, setDocumentNotes] = useState("");

  // Section 2: Penjadwalan
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleStartTime, setScheduleStartTime] = useState("09:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("10:30");
  const [roomId, setRoomId] = useState("");
  const [examiner1Id, setExaminer1Id] = useState("");
  const [examiner2Id, setExaminer2Id] = useState("");

  // Section 3: Persuratan & Arsip
  const [letterNumber, setLetterNumber] = useState("");
  const [letterDate, setLetterDate] = useState("");
  const [letterSignerOfficialId, setLetterSignerOfficialId] = useState("");
  const [letterStatus, setLetterStatus] =
    useState<ThesisLetterStatus>("Belum Dibuat");
  const [archiveNotes, setArchiveNotes] = useState("");
  const [formError, setFormError] = useState("");

  // Modal Hapus
  const [deletingRow, setDeletingRow] = useState<ThesisWorkflow | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const lecturerMap = useMemo(() => {
    const map = new Map<string, (typeof lecturers)[number]>();
    for (const l of lecturers) map.set(l.id, l);
    return map;
  }, [lecturers]);

  const roomMap = useMemo(() => {
    const map = new Map<string, (typeof rooms)[number]>();
    for (const r of rooms) map.set(r.id, r);
    return map;
  }, [rooms]);

  const officialMap = useMemo(() => {
    const map = new Map<string, (typeof campusOfficials)[number]>();
    for (const o of campusOfficials) map.set(o.id, o);
    return map;
  }, [campusOfficials]);

  const copiedSourceIds = useMemo(() => {
    const set = new Set<string>();
    for (const w of thesisWorkflows) {
      if (w.source_workflow_id) set.add(w.source_workflow_id);
    }
    return set;
  }, [thesisWorkflows]);

  const boardItems = useMemo(
    () =>
      thesisWorkflows.filter((w) => w.track === track && w.stage === stage),
    [stage, thesisWorkflows, track]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inspect = new URLSearchParams(window.location.search).get("inspect");
    if (inspect && boardItems.some((item) => item.id === inspect)) {
      setSelectedId(inspect);
    }
  }, [boardItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return boardItems.filter((item) => {
      if (filterProdi !== "ALL" && item.prodi !== filterProdi) return false;
      if (
        filterLetterStatus !== "ALL" &&
        item.letter_status !== filterLetterStatus
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.ticket_code.toLowerCase().includes(q) ||
        item.student_name.toLowerCase().includes(q) ||
        item.student_nim.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.journal_name || "").toLowerCase().includes(q) ||
        (item.letter_number || "").toLowerCase().includes(q)
      );
    });
  }, [boardItems, filterLetterStatus, filterProdi, searchQuery]);

  const activeClassesForProdi = useMemo(() => {
    const active = academicClasses.filter((c) => c.is_active);
    const matched = active.filter((c) => c.prodi === prodi);
    return matched.length > 0 ? matched : active;
  }, [academicClasses, prodi]);

  const scheduleConflictWarning = useMemo(() => {
    if (!modalOpen || !editingRow || !roomId || !scheduleDate) return null;
    const startMin = parseTimeMinutes(scheduleStartTime);
    const endMin = parseTimeMinutes(scheduleEndTime);
    const conflicts = thesisWorkflows.filter((w) => {
      if (w.id === editingRow.id) return false;
      if (w.room_id !== roomId || w.schedule_date !== scheduleDate) {
        return false;
      }
      const wStart = parseTimeMinutes(w.schedule_start_time);
      const wEnd = parseTimeMinutes(w.schedule_end_time);
      if (
        startMin !== null &&
        endMin !== null &&
        wStart !== null &&
        wEnd !== null
      ) {
        return startMin < wEnd && endMin > wStart;
      }
      return true;
    });
    if (conflicts.length === 0) return null;
    const roomObj = roomMap.get(roomId);
    const first = conflicts[0];
    return `Bentrok terdeteksi pada ${roomObj?.code || "ruangan dipilih"} tanggal ${scheduleDate} dengan tiket ${first.ticket_code} (${first.student_name}${first.schedule_start_time ? `, ${first.schedule_start_time}-${first.schedule_end_time}` : ""}). Anda tetap bisa menyimpan jika memang disengaja paralel.`;
  }, [
    editingRow,
    modalOpen,
    roomId,
    roomMap,
    scheduleDate,
    scheduleEndTime,
    scheduleStartTime,
    thesisWorkflows,
  ]);

  if (isLiveSupabase && !canAccessPage(pageKey)) {
    return null;
  }

  if (uiSimState === "loading") {
    return (
      <LoadingStateView message="Memuat papan kerja Tugas Akhir dan jadwal terkait..." />
    );
  }

  if (uiSimState === "error") {
    return (
      <ErrorStateView
        title="Gagal Memuat Papan Tugas Akhir"
        description="Terjadi kendala saat mengambil data antrean Proposal & Sidang dari server."
        onRetry={() => setUiSimState("normal")}
      />
    );
  }

  const todayDefaultDate = isLiveSupabase
    ? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
    : TODAY_ISO;

  const openAddModal = () => {
    setEditingRow(null);
    setFormColumn("berkas_daftar");
    setStudentName("");
    setStudentNim("");
    setStudentPhone("");
    setProdi("MPI");
    setClassId("");
    setTitle("");
    setJournalName("");
    setJournalUrl("");
    setSupervisor1Id("");
    setSupervisor2Id("");
    setRegisteredAt(todayDefaultDate);
    setDocumentNotes("");
    setScheduleDate("");
    setScheduleStartTime("09:00");
    setScheduleEndTime("10:30");
    setRoomId("");
    setExaminer1Id("");
    setExaminer2Id("");
    setLetterNumber("");
    setLetterDate("");
    setLetterSignerOfficialId("");
    setLetterStatus("Belum Dibuat");
    setArchiveNotes("");
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (
    row: ThesisWorkflow,
    options?: { preselectColumn?: ThesisBoardColumn; noticeError?: string }
  ) => {
    setEditingRow(row);
    setFormColumn(options?.preselectColumn || row.board_column);
    setStudentName(row.student_name);
    setStudentNim(row.student_nim);
    setStudentPhone(row.student_phone === "-" ? "" : row.student_phone);
    setProdi(row.prodi);
    setClassId(row.class_id || "");
    setTitle(row.title);
    setJournalName(row.journal_name || "");
    setJournalUrl(row.journal_url || "");
    setSupervisor1Id(row.supervisor_1_id || "");
    setSupervisor2Id(row.supervisor_2_id || "");
    setRegisteredAt(row.registered_at || todayDefaultDate);
    setDocumentNotes(row.document_notes || "");
    setScheduleDate(row.schedule_date || "");
    setScheduleStartTime(row.schedule_start_time || "09:00");
    setScheduleEndTime(row.schedule_end_time || "10:30");
    setRoomId(row.room_id || "");
    setExaminer1Id(row.examiner_1_id || "");
    setExaminer2Id(row.examiner_2_id || "");
    setLetterNumber(row.letter_number || "");
    setLetterDate(row.letter_date || "");
    setLetterSignerOfficialId(row.letter_signer_official_id || "");
    setLetterStatus(row.letter_status || "Belum Dibuat");
    setArchiveNotes(row.archive_notes || "");
    setFormError(options?.noticeError || "");
    setModalOpen(true);
  };

  const handleMoveCard = (
    item: ThesisWorkflow,
    targetColumn: ThesisBoardColumn
  ) => {
    const res = moveThesisWorkflow(item.id, targetColumn);
    if (!res.ok && res.error?.toLowerCase().includes("jadwal")) {
      openEditModal(item, {
        preselectColumn: targetColumn,
        noticeError: res.error,
      });
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!studentName.trim() || !studentNim.trim() || !title.trim()) {
      setFormError("Nama mahasiswa, NIM, dan judul wajib diisi.");
      return;
    }

    const pickedClass = academicClasses.find((c) => c.id === classId) || null;

    if (!editingRow) {
      const res = addThesisWorkflow({
        track,
        stage,
        board_column: "berkas_daftar",
        student_name: studentName.trim(),
        student_nim: studentNim.trim(),
        student_phone: studentPhone.trim() || "-",
        prodi,
        class_id: pickedClass?.id || null,
        class_code: pickedClass?.class_code || null,
        title: title.trim(),
        journal_name: track === "artikel_jurnal" ? journalName.trim() || null : null,
        journal_url: track === "artikel_jurnal" ? journalUrl.trim() || null : null,
        supervisor_1_id: supervisor1Id || null,
        supervisor_2_id: supervisor2Id || null,
        examiner_1_id: null,
        examiner_2_id: null,
        registered_at: registeredAt || todayDefaultDate,
        document_notes: documentNotes.trim() || null,
        schedule_date: null,
        schedule_start_time: null,
        schedule_end_time: null,
        room_id: null,
        letter_number: null,
        letter_date: null,
        letter_signer_official_id: null,
        letter_status: "Belum Dibuat",
        archived_at: null,
        archive_notes: null,
        source_workflow_id: null,
      });

      if (!res.ok) {
        setFormError(res.error || "Gagal mendaftarkan berkas mahasiswa.");
        return;
      }
      setModalOpen(false);
      return;
    }

    if (
      (formColumn === "bikin_surat" || formColumn === "selesai_arsip") &&
      !scheduleDate
    ) {
      setFormError(
        "Lengkapi tanggal jadwal terlebih dahulu sebelum masuk tahap Bikin Surat."
      );
      return;
    }

    const res = updateThesisWorkflow(editingRow.id, {
      board_column: formColumn,
      student_name: studentName.trim(),
      student_nim: studentNim.trim(),
      student_phone: studentPhone.trim() || "-",
      prodi,
      class_id: pickedClass?.id || null,
      class_code: pickedClass?.class_code || null,
      title: title.trim(),
      journal_name: track === "artikel_jurnal" ? journalName.trim() || null : null,
      journal_url: track === "artikel_jurnal" ? journalUrl.trim() || null : null,
      supervisor_1_id: supervisor1Id || null,
      supervisor_2_id: supervisor2Id || null,
      examiner_1_id: examiner1Id || null,
      examiner_2_id: examiner2Id || null,
      registered_at: registeredAt || editingRow.registered_at,
      document_notes: documentNotes.trim() || null,
      schedule_date: scheduleDate || null,
      schedule_start_time: scheduleDate ? scheduleStartTime.trim() || null : null,
      schedule_end_time: scheduleDate ? scheduleEndTime.trim() || null : null,
      room_id: roomId || null,
      letter_number: letterNumber.trim() || null,
      letter_date: letterDate || null,
      letter_signer_official_id: letterSignerOfficialId || null,
      letter_status: letterStatus,
      archive_notes: archiveNotes.trim() || null,
    });

    if (!res.ok) {
      setFormError(res.error || "Gagal menyimpan perubahan.");
      return;
    }
    setModalOpen(false);
  };

  const trackLabel = track === "skripsi" ? "Skripsi" : "Artikel Jurnal";
  const stageLabel = stage === "proposal" ? "Proposal" : "Sidang";
  const pageTitle = `${trackLabel}: ${stageLabel}`;
  const pageSubtitle =
    track === "skripsi"
      ? stage === "proposal"
        ? "Pantau antrean mahasiswa seminar proposal skripsi mulai dari verifikasi berkas daftar, penjadwalan ruang dan penguji, penerbitan surat, hingga arsip selesai."
        : "Kelola alur sidang munaqasyah skripsi dari pendaftaran berkas sidang, pengaturan jadwal dewan penguji, penerbitan surat tugas, hingga arsip selesai."
      : stage === "proposal"
      ? "Kelola pendaftaran dan seminar proposal luaran artikel jurnal ilmiah dari verifikasi berkas, penjadwalan, pembuatan surat undangan, hingga arsip."
      : "Kelola sidang kelayakan dan ujian akhir artikel jurnal dari kelengkapan berkas, penjadwalan ruang dan penguji, penerbitan surat resmi, hingga arsip selesai.";

  const kanbanColumns: KanbanColumnDef<ThesisWorkflow>[] = COLUMN_ORDER.map(
    (colId) => ({
      id: colId,
      title: COLUMN_META[colId].title,
      dotColorClass: COLUMN_META[colId].dotColorClass,
      items: filteredItems.filter((item) => item.board_column === colId),
      onQuickAdd: colId === "berkas_daftar" ? openAddModal : undefined,
    })
  );

  const tableColumns: DataTableColumn<ThesisWorkflow>[] = [
    {
      key: "ticket_student",
      header: "Tiket & Mahasiswa",
      render: (row) => (
        <div className="space-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 font-mono font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              {row.ticket_code}
            </span>
            <span className="px-2 py-0.5 font-mono font-bold rounded bg-[#1E3A5F] text-white dark:bg-sky-400 dark:text-slate-950">
              {row.prodi}
            </span>
          </div>
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {row.student_name}
          </p>
          <p className="font-mono text-slate-600 dark:text-slate-400">
            NIM {row.student_nim}
            {row.class_code ? ` • ${row.class_code}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "title",
      header: "Judul",
      render: (row) => (
        <div className="space-y-1 text-xs max-w-sm">
          <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-relaxed">
            {row.title}
          </p>
          {track === "artikel_jurnal" && row.journal_name ? (
            <p className="text-slate-600 dark:text-slate-400 truncate">
              Jurnal: {row.journal_name}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "supervisors",
      header: "Pembimbing",
      render: (row) => {
        const p1 = row.supervisor_1_id
          ? lecturerMap.get(row.supervisor_1_id)?.full_name
          : null;
        const p2 = row.supervisor_2_id
          ? lecturerMap.get(row.supervisor_2_id)?.full_name
          : null;
        return (
          <div className="space-y-0.5 text-xs">
            <p className="text-slate-900 dark:text-slate-100 font-medium">
              1. {p1 || "-"}
            </p>
            {p2 ? (
              <p className="text-slate-600 dark:text-slate-400">2. {p2}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "schedule",
      header: "Jadwal & Ruang",
      render: (row) => {
        const room = row.room_id ? roomMap.get(row.room_id) : null;
        return (
          <div className="space-y-0.5 text-xs">
            {row.schedule_date ? (
              <>
                <p className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {row.schedule_date}
                </p>
                <p className="font-mono text-slate-600 dark:text-slate-400">
                  {row.schedule_start_time || "-"} -{" "}
                  {row.schedule_end_time || "-"} WIB
                </p>
                <p className="text-[#1E3A5F] dark:text-sky-400 font-semibold">
                  {room ? `${room.code} (${room.name})` : "Ruang belum dipilih"}
                </p>
              </>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                Belum dijadwalkan
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "letter",
      header: "Surat",
      render: (row) => (
        <div className="space-y-1 text-xs">
          <LetterStatusBadge status={row.letter_status} />
          {row.letter_number ? (
            <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {row.letter_number}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "stage_col",
      header: "Tahap",
      render: (row) => <ColumnBadge col={row.board_column} />,
    },
  ];

  const selectedRow = boardItems.find((w) => w.id === selectedId) || null;
  const selectedSourceProposal =
    selectedRow?.source_workflow_id
      ? thesisWorkflows.find((w) => w.id === selectedRow.source_workflow_id) ||
        null
      : null;
  const selectedChildSidang =
    selectedRow?.stage === "proposal"
      ? thesisWorkflows.find((w) => w.source_workflow_id === selectedRow.id) ||
        null
      : null;

  const activeFilterCount =
    (filterProdi !== "ALL" ? 1 : 0) + (filterLetterStatus !== "ALL" ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-300 dark:border-slate-800">
        <div className="space-y-1">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400">
            TUGAS AKHIR • {trackLabel.toUpperCase()}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {pageTitle}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            {pageSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canAccessSibling ? (
            <div
              role="group"
              aria-label={`Pindah sub-menu ${trackLabel}`}
              className="inline-flex rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5"
            >
              <Link
                href={getThesisHref(track, "proposal")}
                className={`min-h-[40px] px-3 inline-flex items-center rounded text-xs font-bold transition-colors ${
                  stage === "proposal"
                    ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                }`}
              >
                Proposal
              </Link>
              <Link
                href={getThesisHref(track, "sidang")}
                className={`min-h-[40px] px-3 inline-flex items-center rounded text-xs font-bold transition-colors ${
                  stage === "sidang"
                    ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                }`}
              >
                Sidang
              </Link>
            </div>
          ) : null}

          <Button type="button" variant="primary" onClick={openAddModal}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Daftarkan Berkas Mahasiswa</span>
          </Button>
        </div>
      </section>

      {/* Banner peringatan bila tabel SQL migrasi 011 belum dibuat di database live */}
      {isLiveSupabase && !thesisWorkflowsAvailable ? (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-lg border-2 border-amber-600 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 text-xs"
        >
          <AlertTriangle
            className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-bold">
              Tabel Database Tugas Akhir Belum Aktif di Supabase
            </p>
            <p className="leading-relaxed">
              Jalankan skrip migrasi{" "}
              <code className="font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900/60">
                supabase/migrations/011_tugas_akhir_workflow.sql
              </code>{" "}
              di SQL Editor Supabase agar pendaftaran dan papan kerja tersimpan ke database live.
            </p>
          </div>
        </div>
      ) : null}

      {/* 4 Kartu Ringkasan Tahap Kolom */}
      <section aria-label="Ringkasan Antrean per Kolom Papan">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMN_ORDER.map((colId) => {
            const meta = COLUMN_META[colId];
            const count = boardItems.filter(
              (item) => item.board_column === colId
            ).length;
            return (
              <div
                key={colId}
                className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dotColorClass}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {meta.title}
                    </span>
                  </div>
                  <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-white">
                    {count}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  {meta.shortDesc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Toolbar Pencarian, Filter & Switch Board / Tabel */}
      <section
        aria-label="Filter dan Pencarian Papan Kerja"
        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama mahasiswa, NIM, tiket, atau judul..."
            aria-label="Cari mahasiswa atau judul tugas akhir"
            className="min-h-[44px] w-full sm:w-80 px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
          />

          <FilterPopover
            title="Filter Antrean Tugas Akhir"
            activeCount={activeFilterCount}
            onResetAll={() => {
              setFilterProdi("ALL");
              setFilterLetterStatus("ALL");
            }}
            groups={[
              {
                key: "prodi",
                label: "Program Studi",
                value: filterProdi,
                onChange: setFilterProdi,
                options: [
                  { value: "ALL", label: "Semua Prodi" },
                  ...PRODI_ENUM_LIST.map((p) => ({ value: p, label: p })),
                ],
              },
              {
                key: "letter_status",
                label: "Status Surat",
                value: filterLetterStatus,
                onChange: setFilterLetterStatus,
                options: [
                  { value: "ALL", label: "Semua Status Surat" },
                  ...LETTER_STATUSES.map((s) => ({ value: s, label: s })),
                ],
              },
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "table" ? (
            <ColumnsTogglePopover
              columns={tableColumns.map((c) => ({
                key: c.key,
                label: c.header,
              }))}
              hiddenKeys={hiddenCols}
              onToggleKey={(key) =>
                setHiddenCols((prev) =>
                  prev.includes(key)
                    ? prev.filter((k) => k !== key)
                    : [...prev, key]
                )
              }
            />
          ) : null}

          <div
            role="group"
            aria-label="Pilih tampilan papan atau tabel"
            className="inline-flex rounded-md border border-slate-400 dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setViewMode("board")}
              aria-pressed={viewMode === "board"}
              className={`min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded text-xs font-bold transition-colors ${
                viewMode === "board"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <KanbanSquare className="w-4 h-4" aria-hidden="true" />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              className={`min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded text-xs font-bold transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-sm"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              <Table2 className="w-4 h-4" aria-hidden="true" />
              <span>Tabel</span>
            </button>
          </div>
        </div>
      </section>

      {/* Konten Utama: Papan Kerja (Default) atau Tabel */}
      {viewMode === "board" ? (
        <KanbanBoard
          columns={kanbanColumns}
          rowKey={(item) => item.id}
          activeItemId={selectedId}
          onCardClick={(item) => setSelectedId(item.id)}
          columnEmptyMessage="Belum ada berkas di tahap ini"
          onCardDrop={(item, _src, targetColId) =>
            handleMoveCard(item, targetColId as ThesisBoardColumn)
          }
          renderCard={(row) => {
            const p1 = row.supervisor_1_id
              ? lecturerMap.get(row.supervisor_1_id)?.full_name
              : undefined;
            const room = row.room_id ? roomMap.get(row.room_id) : undefined;
            const noteCount = notes.filter(
              (n) => n.entity_type === entityType && n.entity_id === row.id
            ).length;
            const attCount = attachments.filter(
              (a) => a.entity_type === entityType && a.entity_id === row.id
            ).length;

            const colIdx = COLUMN_ORDER.indexOf(row.board_column);
            const prevCol = colIdx > 0 ? COLUMN_ORDER[colIdx - 1] : null;
            const nextCol =
              colIdx < COLUMN_ORDER.length - 1
                ? COLUMN_ORDER[colIdx + 1]
                : null;
            const showLetterBadge =
              row.board_column === "bikin_surat" ||
              row.board_column === "selesai_arsip";
            const alreadyCopied = copiedSourceIds.has(row.id);
            const canCopyToSidang =
              stage === "proposal" &&
              (row.board_column === "bikin_surat" ||
                row.board_column === "selesai_arsip") &&
              canAccessSidang;

            const ageLabel = row.schedule_date
              ? `${row.schedule_date}${
                  row.schedule_start_time ? ` • ${row.schedule_start_time}` : ""
                }${room ? ` (${room.code})` : ""}`
              : `Daftar: ${row.registered_at}`;

            return {
              code: row.ticket_code,
              title: row.student_name,
              subtitle: `${row.student_nim} • Prodi ${row.prodi}${
                row.class_code ? ` (${row.class_code})` : ""
              }`,
              description: row.title,
              assigneeName: p1,
              ageLabel,
              priorityBadge: showLetterBadge ? (
                <LetterStatusBadge status={row.letter_status} />
              ) : row.source_workflow_id ? (
                <Badge tone="info">Dari Proposal</Badge>
              ) : undefined,
              notesCount: noteCount,
              attachmentsCount: attCount,
              progressPercent: COLUMN_META[row.board_column].progressPercent,
              progressColorClass:
                COLUMN_META[row.board_column].progressColorClass,
              footerAction: (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {prevCol ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Kembalikan ke ${COLUMN_META[prevCol].title}`}
                        title={`Kembalikan ke ${COLUMN_META[prevCol].title}`}
                        onClick={() => handleMoveCard(row, prevCol)}
                      >
                        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}

                    {nextCol ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleMoveCard(row, nextCol)}
                      >
                        <span>Lanjut ke {COLUMN_META[nextCol].title}</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEditModal(row)}
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Kelola Arsip</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Edit berkas ${row.ticket_code}`}
                      title="Edit Detail"
                      onClick={() => openEditModal(row)}
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    </Button>
                  </div>

                  {canCopyToSidang ? (
                    alreadyCopied ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                        className="w-full"
                      >
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-emerald-600"
                          aria-hidden="true"
                        />
                        <span>Sudah di Antrean Sidang</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => copyThesisToSidang(row.id)}
                      >
                        <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Salin ke Antrean Sidang</span>
                      </Button>
                    )
                  ) : null}
                </div>
              ),
            };
          }}
        />
      ) : (
        <DataTable
          columns={tableColumns}
          data={filteredItems}
          rowKey={(row) => row.id}
          hiddenColumnKeys={hiddenCols}
          activeRowKey={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          emptyTitle={`Belum Ada Berkas ${pageTitle}`}
          emptyDescription="Tambahkan pendaftaran berkas mahasiswa agar alur penjadwalan dan surat dapat dipantau."
          emptyActionLabel="Daftarkan Berkas Mahasiswa"
          onEmptyAction={openAddModal}
        />
      )}

      {/* Drawer Detail Lengkap & Catatan/Lampiran */}
      <Drawer
        isOpen={Boolean(selectedRow)}
        onClose={() => setSelectedId(null)}
        title={selectedRow ? selectedRow.student_name : ""}
        subtitle={
          selectedRow
            ? `${selectedRow.ticket_code} • NIM ${selectedRow.student_nim} • Prodi ${selectedRow.prodi}`
            : undefined
        }
        headerBadge={
          selectedRow ? (
            <>
              <ColumnBadge col={selectedRow.board_column} />
              <LetterStatusBadge status={selectedRow.letter_status} />
            </>
          ) : undefined
        }
        footer={
          selectedRow ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeleteError("");
                  setDeletingRow(selectedRow);
                }}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Hapus Berkas</span>
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                {selectedRow.stage === "proposal" &&
                (selectedRow.board_column === "bikin_surat" ||
                  selectedRow.board_column === "selesai_arsip") &&
                canAccessSidang ? (
                  copiedSourceIds.has(selectedRow.id) ? (
                    <Button type="button" variant="outline" size="sm" disabled>
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Sudah di Antrean Sidang</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => copyThesisToSidang(selectedRow.id)}
                    >
                      <CopyPlus className="w-4 h-4" aria-hidden="true" />
                      <span>Salin ke Antrean Sidang</span>
                    </Button>
                  )
                ) : null}

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => openEditModal(selectedRow)}
                >
                  <Edit3 className="w-4 h-4" aria-hidden="true" />
                  <span>Edit &amp; Kelola Tahap</span>
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedRow ? (
          <div className="space-y-5 text-xs">
            {/* Link Relasi Proposal <-> Sidang */}
            {selectedSourceProposal ? (
              <div className="p-3 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/40 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-sky-950 dark:text-sky-200">
                    Disalin dari Proposal: {selectedSourceProposal.ticket_code}
                  </p>
                  <p className="text-[11px] text-sky-800 dark:text-sky-300">
                    Tahap Proposal saat ini:{" "}
                    {COLUMN_META[selectedSourceProposal.board_column].title}
                  </p>
                </div>
                {canAccessPage(getThesisPageKey(track, "proposal")) ? (
                  <Link
                    href={`${getThesisHref(track, "proposal")}?inspect=${selectedSourceProposal.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-sky-400 dark:border-sky-700 text-xs font-bold text-[#1E3A5F] dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-slate-800"
                  >
                    <span>Buka Proposal</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            ) : null}

            {selectedChildSidang ? (
              <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-emerald-950 dark:text-emerald-200">
                    Sudah Masuk Antrean Sidang: {selectedChildSidang.ticket_code}
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    Posisi papan Sidang:{" "}
                    {COLUMN_META[selectedChildSidang.board_column].title}
                  </p>
                </div>
                {canAccessSidang ? (
                  <Link
                    href={`${getThesisHref(track, "sidang")}?inspect=${selectedChildSidang.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-emerald-500 dark:border-emerald-700 text-xs font-bold text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-slate-800"
                  >
                    <span>Buka Sidang</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            ) : null}

            {/* Judul & Jurnal */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-mono font-bold uppercase text-[11px]">
                <ScrollText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Judul {trackLabel}</span>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                {selectedRow.title}
              </p>
              {track === "artikel_jurnal" &&
              (selectedRow.journal_name || selectedRow.journal_url) ? (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                  {selectedRow.journal_name ? (
                    <p className="text-slate-700 dark:text-slate-300">
                      Jurnal Target: <strong>{selectedRow.journal_name}</strong>
                    </p>
                  ) : null}
                  {selectedRow.journal_url ? (
                    <p className="text-slate-600 dark:text-slate-400 break-all">
                      Tautan OJS/Jurnal: {selectedRow.journal_url}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Identitas & Pembimbing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="font-mono font-bold uppercase text-[11px] text-slate-500 dark:text-slate-400">
                  Identitas Mahasiswa &amp; Berkas
                </p>
                <p>
                  Kontak WA:{" "}
                  <strong className="font-mono">
                    {selectedRow.student_phone || "-"}
                  </strong>
                </p>
                <p>
                  Kelas:{" "}
                  <strong className="font-mono">
                    {selectedRow.class_code || "Tidak tertaut"}
                  </strong>
                </p>
                <p>
                  Tanggal Daftar:{" "}
                  <strong className="font-mono">
                    {selectedRow.registered_at}
                  </strong>
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Petugas Input: {selectedRow.created_by_staff || "-"}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="font-mono font-bold uppercase text-[11px] text-slate-500 dark:text-slate-400">
                  Dosen Pembimbing
                </p>
                <p>
                  Pembimbing 1:{" "}
                  <strong>
                    {selectedRow.supervisor_1_id
                      ? lecturerMap.get(selectedRow.supervisor_1_id)
                          ?.full_name || "-"
                      : "-"}
                  </strong>
                </p>
                <p>
                  Pembimbing 2:{" "}
                  <strong>
                    {selectedRow.supervisor_2_id
                      ? lecturerMap.get(selectedRow.supervisor_2_id)
                          ?.full_name || "-"
                      : "-"}
                  </strong>
                </p>
                {selectedRow.document_notes ? (
                  <p className="pt-1 text-slate-600 dark:text-slate-400">
                    Catatan Berkas: {selectedRow.document_notes}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Penjadwalan & Penguji */}
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 font-mono font-bold uppercase text-[11px] text-[#1E3A5F] dark:text-sky-400">
                <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Jadwal Pelaksanaan &amp; Penguji</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <p>
                  Tanggal &amp; Jam:{" "}
                  <strong className="font-mono">
                    {selectedRow.schedule_date
                      ? `${selectedRow.schedule_date} (${
                          selectedRow.schedule_start_time || "-"
                        } - ${selectedRow.schedule_end_time || "-"} WIB)`
                      : "Belum dijadwalkan"}
                  </strong>
                </p>
                <p>
                  Ruangan:{" "}
                  <strong>
                    {selectedRow.room_id
                      ? (() => {
                          const r = roomMap.get(selectedRow.room_id);
                          return r ? `${r.code} (${r.name})` : "-";
                        })()
                      : "-"}
                  </strong>
                </p>
                <p>
                  Penguji 1 / Ketua:{" "}
                  <strong>
                    {selectedRow.examiner_1_id
                      ? lecturerMap.get(selectedRow.examiner_1_id)?.full_name ||
                        "-"
                      : "-"}
                  </strong>
                </p>
                <p>
                  Penguji 2 / Sekretaris:{" "}
                  <strong>
                    {selectedRow.examiner_2_id
                      ? lecturerMap.get(selectedRow.examiner_2_id)?.full_name ||
                        "-"
                      : "-"}
                  </strong>
                </p>
              </div>
            </div>

            {/* Persuratan & Arsip */}
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 font-mono font-bold uppercase text-[11px] text-emerald-800 dark:text-emerald-400">
                <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Persuratan &amp; Status Arsip</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <p>
                  Nomor Surat:{" "}
                  <strong className="font-mono">
                    {selectedRow.letter_number || "-"}
                  </strong>
                </p>
                <p>
                  Tanggal Surat:{" "}
                  <strong className="font-mono">
                    {selectedRow.letter_date || "-"}
                  </strong>
                </p>
                <p>
                  Penandatangan:{" "}
                  <strong>
                    {selectedRow.letter_signer_official_id
                      ? officialMap.get(selectedRow.letter_signer_official_id)
                          ?.full_name || "-"
                      : "-"}
                  </strong>
                </p>
                <p className="flex items-center gap-1.5">
                  <span>Status Surat:</span>
                  <LetterStatusBadge status={selectedRow.letter_status} />
                </p>
              </div>
              {selectedRow.archived_at ? (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                    <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Diarsipkan: {formatWibIso(selectedRow.archived_at)}</span>
                  </p>
                  {selectedRow.archive_notes ? (
                    <p className="text-slate-600 dark:text-slate-400">
                      Catatan Arsip: {selectedRow.archive_notes}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Catatan & Unggah Berkas */}
            <EntityDrawerSections
              entityType={entityType}
              entityId={selectedRow.id}
            />
          </div>
        ) : null}
      </Drawer>

      {/* Modal Tambah / Edit Berkas Tugas Akhir */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingRow
            ? `Kelola Berkas ${editingRow.ticket_code}`
            : `Daftarkan Berkas ${pageTitle}`
        }
        description={
          editingRow
            ? "Perbarui kelengkapan berkas, penjadwalan ruang & dewan penguji, serta nomor surat tugas."
            : "Berkas mahasiswa baru masuk otomatis ke kolom Berkas Daftar."
        }
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-5">
          {formError ? (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-600 text-xs font-medium text-red-900 dark:text-red-200"
            >
              {formError}
            </div>
          ) : null}

          {/* Section 1: Identitas & Berkas */}
          <fieldset className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
            <legend className="px-2 text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>1. Identitas &amp; Berkas</span>
            </legend>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Nama Mahasiswa *"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Contoh: Naufal Hidayat"
                required
              />
              <Input
                label="NIM *"
                value={studentNim}
                onChange={(e) => setStudentNim(e.target.value)}
                placeholder="Contoh: 22104010014"
                required
              />
              <Input
                label="No. WhatsApp"
                value={studentPhone}
                onChange={(e) => setStudentPhone(e.target.value)}
                placeholder="Contoh: 0852-xxxx-xxxx"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Program Studi *"
                value={prodi}
                onChange={(e) => {
                  setProdi(e.target.value as ProdiCode);
                  setClassId("");
                }}
                options={PRODI_ENUM_LIST.map((p) => ({ value: p, label: p }))}
              />
              <Select
                label="Kelas (Opsional)"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                options={[
                  { value: "", label: "Tanpa kelas spesifik" },
                  ...activeClassesForProdi.map((c) => ({
                    value: c.id,
                    label: `${c.class_code} (${c.prodi})`,
                  })),
                ]}
              />
              <Input
                label="Tanggal Daftar *"
                type="date"
                value={registeredAt}
                onChange={(e) => setRegisteredAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Judul {trackLabel} *
              </label>
              <textarea
                rows={2}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Tuliskan judul lengkap ${trackLabel.toLowerCase()}...`}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              />
            </div>

            {track === "artikel_jurnal" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Nama Jurnal Target (Opsional)"
                  value={journalName}
                  onChange={(e) => setJournalName(e.target.value)}
                  placeholder="Contoh: Jurnal Manajemen Pendidikan Islam"
                />
                <Input
                  label="Tautan OJS / Jurnal (Opsional)"
                  value={journalUrl}
                  onChange={(e) => setJournalUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Dosen Pembimbing 1"
                value={supervisor1Id}
                onChange={(e) => setSupervisor1Id(e.target.value)}
                options={[
                  { value: "", label: "Belum ditetapkan" },
                  ...lecturers
                    .filter((l) => l.is_active)
                    .map((l) => ({ value: l.id, label: l.full_name })),
                ]}
              />
              <Select
                label="Dosen Pembimbing 2 (Opsional)"
                value={supervisor2Id}
                onChange={(e) => setSupervisor2Id(e.target.value)}
                options={[
                  { value: "", label: "Tidak ada / Belum ditetapkan" },
                  ...lecturers
                    .filter((l) => l.is_active)
                    .map((l) => ({ value: l.id, label: l.full_name })),
                ]}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Catatan Kelengkapan Berkas
              </label>
              <textarea
                rows={2}
                value={documentNotes}
                onChange={(e) => setDocumentNotes(e.target.value)}
                placeholder="Contoh: Transkrip, lembar ACC pembimbing, cek turnitin..."
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
              />
            </div>
          </fieldset>

          {/* Section 2 & 3 hanya tampil pada mode edit */}
          {editingRow ? (
            <>
              <fieldset className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                <legend className="px-2 text-xs font-mono font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-sky-400 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>2. Penjadwalan &amp; Dewan Penguji</span>
                </legend>

                {scheduleConflictWarning ? (
                  <div
                    role="status"
                    className="flex items-start gap-2.5 p-3 rounded-md border border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-xs text-amber-950 dark:text-amber-200"
                  >
                    <AlertTriangle
                      className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{scheduleConflictWarning}</span>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Tanggal Pelaksanaan"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                  <Input
                    label="Jam Mulai (WIB)"
                    type="time"
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                  />
                  <Input
                    label="Jam Selesai (WIB)"
                    type="time"
                    value={scheduleEndTime}
                    onChange={(e) => setScheduleEndTime(e.target.value)}
                  />
                </div>

                <Select
                  label="Ruangan Pelaksanaan"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  options={[
                    { value: "", label: "Belum dipilih" },
                    ...rooms.map((r) => ({
                      value: r.id,
                      label: `${r.code} - ${r.name}`,
                    })),
                  ]}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Penguji 1 / Ketua Sidang"
                    value={examiner1Id}
                    onChange={(e) => setExaminer1Id(e.target.value)}
                    options={[
                      { value: "", label: "Belum ditetapkan" },
                      ...lecturers
                        .filter((l) => l.is_active)
                        .map((l) => ({ value: l.id, label: l.full_name })),
                    ]}
                  />
                  <Select
                    label="Penguji 2 / Sekretaris"
                    value={examiner2Id}
                    onChange={(e) => setExaminer2Id(e.target.value)}
                    options={[
                      { value: "", label: "Belum ditetapkan" },
                      ...lecturers
                        .filter((l) => l.is_active)
                        .map((l) => ({ value: l.id, label: l.full_name })),
                    ]}
                  />
                </div>
              </fieldset>

              <fieldset className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                <legend className="px-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>3. Persuratan &amp; Tahap Papan</span>
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Tahap Kolom Papan *"
                    value={formColumn}
                    onChange={(e) =>
                      setFormColumn(e.target.value as ThesisBoardColumn)
                    }
                    options={COLUMN_ORDER.map((col) => ({
                      value: col,
                      label: COLUMN_META[col].title,
                    }))}
                  />
                  <Select
                    label="Status Surat *"
                    value={letterStatus}
                    onChange={(e) =>
                      setLetterStatus(e.target.value as ThesisLetterStatus)
                    }
                    options={LETTER_STATUSES.map((s) => ({
                      value: s,
                      label: s,
                    }))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Nomor Surat"
                    value={letterNumber}
                    onChange={(e) => setLetterNumber(e.target.value)}
                    placeholder="Contoh: B-445/FTK/PP.009/11/2026"
                  />
                  <Input
                    label="Tanggal Surat"
                    type="date"
                    value={letterDate}
                    onChange={(e) => setLetterDate(e.target.value)}
                  />
                  <Select
                    label="Pejabat Penandatangan"
                    value={letterSignerOfficialId}
                    onChange={(e) =>
                      setLetterSignerOfficialId(e.target.value)
                    }
                    options={[
                      { value: "", label: "Belum dipilih" },
                      ...campusOfficials
                        .filter((o) => o.is_active)
                        .map((o) => ({
                          value: o.id,
                          label: `${o.full_name} (${o.position_title})`,
                        })),
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Catatan Arsip / Hasil Pelaksanaan
                  </label>
                  <textarea
                    rows={2}
                    value={archiveNotes}
                    onChange={(e) => setArchiveNotes(e.target.value)}
                    placeholder="Opsional: catatan berita acara atau arsip selesai..."
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400"
                  />
                </div>
              </fieldset>
            </>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary">
              {editingRow ? "Simpan Perubahan" : "Daftarkan ke Berkas Daftar"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingRow)}
        onClose={() => setDeletingRow(null)}
        title="Konfirmasi Hapus Berkas Tugas Akhir"
        targetBadge={deletingRow?.ticket_code}
        targetName={
          deletingRow
            ? `${deletingRow.student_name} (${deletingRow.student_nim})`
            : ""
        }
        impactNotes={[
          "Seluruh catatan aktivitas dan lampiran berkas pada tiket ini ikut dihapus.",
          deletingRow?.stage === "proposal" &&
          deletingRow &&
          copiedSourceIds.has(deletingRow.id)
            ? "Data yang sudah disalin ke antrean Sidang tetap tersimpan dan tautan sumbernya dilepas."
            : "Tindakan penghapusan bersifat permanen.",
        ]}
        errorMessage={deleteError}
        isSubmitting={deleting}
        onConfirm={async () => {
          if (!deletingRow) return;
          setDeleting(true);
          setDeleteError("");
          const res = await deleteThesisWorkflow(deletingRow.id);
          setDeleting(false);
          if (!res.ok) {
            setDeleteError(res.error || "Gagal menghapus berkas.");
            return;
          }
          if (selectedId === deletingRow.id) {
            setSelectedId(null);
          }
          setDeletingRow(null);
        }}
      />
    </div>
  );
}
