"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Phone, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/utils";
import { formatCustomerName } from "@/lib/names";
import type { CateringLeadWithMerchant } from "@/services/catering/catering.types";

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: CateringLeadWithMerchant | null;
  onStatusUpdate: (leadId: string, status: string) => Promise<void>;
}

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  contacted: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
} as const;

export function LeadDetailModal({
  isOpen,
  onClose,
  lead,
  onStatusUpdate,
}: LeadDetailModalProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !lead) return null;

  const handleStatusUpdate = async (status: string) => {
    setIsUpdating(true);
    try {
      await onStatusUpdate(lead.id, status);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateOrder = () => {
    onClose();
    router.push(
      `/dashboard/catering/orders/new?leadId=${lead.id}&merchantId=${lead.merchantId}`
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canCreateOrder =
    lead.status !== "completed" && lead.status !== "cancelled";
  const canMarkContacted = lead.status === "pending";
  const canCancel =
    lead.status !== "cancelled" && lead.status !== "completed";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lead Details</h2>
            <p className="text-sm text-gray-500">{lead.merchant.name}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-6 px-6 py-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                STATUS_COLORS[lead.status as keyof typeof STATUS_COLORS] ||
                "bg-gray-100 text-gray-800"
              }`}
            >
              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
            </span>
            <span className="text-sm text-gray-500">
              Submitted {formatDate(lead.createdAt)}
            </span>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">Contact Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {formatCustomerName(lead.firstName, lead.lastName)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4" />
                <span>{formatPhone(lead.phone)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="h-4 w-4" />
                <span>{lead.email}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">Notes</h3>
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {lead.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <div className="flex gap-2">
            {canMarkContacted && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusUpdate("contacted")}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Mark Contacted
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusUpdate("cancelled")}
                disabled={isUpdating}
                className="text-red-600 hover:text-red-700"
              >
                Cancel Lead
              </Button>
            )}
          </div>
          {canCreateOrder && (
            <Button onClick={handleCreateOrder} disabled={isUpdating}>
              Create Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
