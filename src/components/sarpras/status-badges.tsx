import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Wrench,
  XCircle,
} from "lucide-react";
import { Badge, BadgeTone } from "@/components/ui/badge";
import {
  AssetCondition,
  BookingStatus,
  MaintenancePriority,
  MaintenanceStatus,
  RoomStatus,
} from "@/types/sarpras";

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const map: Record<RoomStatus, { tone: BadgeTone; icon: React.ReactNode }> = {
    Tersedia: {
      tone: "success",
      icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    Digunakan: {
      tone: "info",
      icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    Perbaikan: {
      tone: "danger",
      icon: <Wrench className="w-3.5 h-3.5" aria-hidden="true" />,
    },
  };
  const cfg = map[status];
  return (
    <Badge tone={cfg.tone}>
      {cfg.icon}
      <span>{status}</span>
    </Badge>
  );
}

export function AssetConditionBadge({
  condition,
}: {
  condition: AssetCondition;
}) {
  const map: Record<
    AssetCondition,
    { tone: BadgeTone; icon: React.ReactNode }
  > = {
    Baik: {
      tone: "success",
      icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    "Rusak Ringan": {
      tone: "warning",
      icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    "Rusak Berat": {
      tone: "danger",
      icon: <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    Hilang: {
      tone: "neutral",
      icon: <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
  };
  const cfg = map[condition];
  return (
    <Badge tone={cfg.tone}>
      {cfg.icon}
      <span>{condition}</span>
    </Badge>
  );
}

export function PriorityBadge({
  priority,
}: {
  priority: MaintenancePriority;
}) {
  const map: Record<
    MaintenancePriority,
    { tone: BadgeTone; icon: React.ReactNode }
  > = {
    Rendah: {
      tone: "neutral",
      icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    Sedang: {
      tone: "warning",
      icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    "Tinggi/Darurat": {
      tone: "danger",
      icon: <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
  };
  const cfg = map[priority];
  return (
    <Badge tone={cfg.tone}>
      {cfg.icon}
      <span>Prioritas: {priority}</span>
    </Badge>
  );
}

export function MaintenanceStatusBadge({
  status,
}: {
  status: MaintenanceStatus;
}) {
  const map: Record<
    MaintenanceStatus,
    { tone: BadgeTone; icon: React.ReactNode }
  > = {
    Dilaporkan: {
      tone: "warning",
      icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    "Dalam Pengerjaan": {
      tone: "info",
      icon: <Wrench className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    "Selesai Diperbaiki": {
      tone: "success",
      icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
    },
  };
  const cfg = map[status];
  return (
    <Badge tone={cfg.tone}>
      {cfg.icon}
      <span>{status}</span>
    </Badge>
  );
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<
    BookingStatus,
    { tone: BadgeTone; icon: React.ReactNode }
  > = {
    "Menunggu Persetujuan": {
      tone: "warning",
      icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    Disetujui: {
      tone: "info",
      icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    "Sedang Dipinjam": {
      tone: "info",
      icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    "Selesai / Dikembalikan": {
      tone: "success",
      icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
    },
    Ditolak: {
      tone: "danger",
      icon: <XCircle className="w-3.5 h-3.5" aria-hidden="true" />,
    },
  };
  const cfg = map[status];
  return (
    <Badge tone={cfg.tone}>
      {cfg.icon}
      <span>{status}</span>
    </Badge>
  );
}
