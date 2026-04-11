"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TextField,
  TextareaField,
  SelectField,
  RadioGroupField,
  CheckboxField,
  PriceField,
} from "@/components/dashboard/Form";
import { BusinessHoursEditor } from "./BusinessHoursEditor";
import { TipConfigEditor } from "./TipConfigEditor";
import { FeeConfigEditor } from "./FeeConfigEditor";
import { updateLocationAction } from "@/app/(dashboard)/dashboard/(protected)/locations/[merchantId]/actions";
import {
  CURRENCY_OPTIONS,
  LOCALE_OPTIONS,
  TIMEZONE_OPTIONS,
} from "@/constants/i18n";
import type { MerchantWithTenant } from "@/services/merchant/merchant.types";
import type { BusinessHoursMap, MerchantStatus } from "@/types/merchant";
import type { TipConfig, FeeConfig } from "@/types";

interface LocationConfigFormProps {
  merchant: MerchantWithTenant;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "temporarily_closed", label: "Temporarily Closed" },
];

const DEFAULT_BUSINESS_HOURS: BusinessHoursMap = {
  monday: { open: "09:00", close: "21:00" },
  tuesday: { open: "09:00", close: "21:00" },
  wednesday: { open: "09:00", close: "21:00" },
  thursday: { open: "09:00", close: "21:00" },
  friday: { open: "09:00", close: "21:00" },
  saturday: { open: "09:00", close: "21:00" },
  sunday: { open: "09:00", close: "21:00", closed: true },
};

export function LocationConfigForm({ merchant }: LocationConfigFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Basic Info
  const [name, setName] = useState(merchant.name);
  const [slug, setSlug] = useState(merchant.slug);
  const [description, setDescription] = useState(merchant.description || "");
  const [status, setStatus] = useState<MerchantStatus>(merchant.status);

  // Location & Contact
  const [address, setAddress] = useState(merchant.address || "");
  const [city, setCity] = useState(merchant.city || "");
  const [state, setState] = useState(merchant.state || "");
  const [zipCode, setZipCode] = useState(merchant.zipCode || "");
  const [country, setCountry] = useState(merchant.country || "US");
  const [phone, setPhone] = useState(merchant.phone || "");
  const [email, setEmail] = useState(merchant.email || "");

  // Media
  const [logoUrl, setLogoUrl] = useState(merchant.logoUrl || "");
  const [bannerUrl, setBannerUrl] = useState(merchant.bannerUrl || "");

  // Regional Settings
  const [currency, setCurrency] = useState(merchant.currency);
  const [locale, setLocale] = useState(merchant.locale);
  const [timezone, setTimezone] = useState(merchant.timezone);

  // Business Hours
  const [businessHours, setBusinessHours] = useState<BusinessHoursMap>(
    merchant.businessHours || DEFAULT_BUSINESS_HOURS
  );

  // Service Modes
  const [acceptsPickup, setAcceptsPickup] = useState(
    merchant.settings?.acceptsPickup ?? true
  );
  const [acceptsDelivery, setAcceptsDelivery] = useState(
    merchant.settings?.acceptsDelivery ?? false
  );
  const [deliveryRadius, setDeliveryRadius] = useState(
    merchant.settings?.deliveryRadius?.toString() || ""
  );
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(
    merchant.settings?.minimumOrderAmount?.toString() || ""
  );
  const [estimatedPrepTime, setEstimatedPrepTime] = useState(
    merchant.settings?.estimatedPrepTime?.toString() || ""
  );

  // Tip Config
  const [tipConfig, setTipConfig] = useState<TipConfig>(
    merchant.settings?.tipConfig || {
      mode: "percentage",
      tiers: [0.15, 0.18, 0.2],
      allowCustom: true,
    }
  );

  // Fee Config
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(
    merchant.settings?.feeConfig || { fees: [] }
  );

  const handleSubmit = () => {
    setError(null);
    setSuccessMessage(null);

    // Basic validation
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }

    startTransition(async () => {
      const result = await updateLocationAction(merchant.id, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        status,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        country,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        bannerUrl: bannerUrl.trim() || undefined,
        currency,
        locale,
        timezone,
        businessHours,
        settings: {
          acceptsPickup,
          acceptsDelivery,
          deliveryRadius: deliveryRadius ? parseFloat(deliveryRadius) : undefined,
          minimumOrderAmount: minimumOrderAmount
            ? parseFloat(minimumOrderAmount)
            : undefined,
          estimatedPrepTime: estimatedPrepTime
            ? parseInt(estimatedPrepTime, 10)
            : undefined,
          tipConfig,
          feeConfig,
        },
      });

      if (result.success) {
        setSuccessMessage("Location settings saved successfully!");
        router.refresh();
      } else {
        setError(result.error || "Failed to save settings");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4 text-green-800">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-800">{error}</div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            id="name"
            label="Name"
            required
            value={name}
            onChange={setName}
            placeholder="e.g., Downtown Location"
          />
          <TextField
            id="slug"
            label="Slug"
            required
            value={slug}
            onChange={setSlug}
            placeholder="e.g., downtown"
            helperText="Used in URL: /r/{slug}/menu"
          />
          <TextareaField
            id="description"
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="Brief description of this location..."
            rows={3}
          />
          <RadioGroupField
            id="status"
            name="status"
            label="Status"
            value={status}
            onChange={(val) => setStatus(val as MerchantStatus)}
            options={STATUS_OPTIONS}
          />
        </CardContent>
      </Card>

      {/* Location & Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Location & Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            id="address"
            label="Address"
            value={address}
            onChange={setAddress}
            placeholder="123 Main Street"
          />
          <div className="grid grid-cols-3 gap-4">
            <TextField
              id="city"
              label="City"
              value={city}
              onChange={setCity}
              placeholder="New York"
              layout="vertical"
            />
            <TextField
              id="state"
              label="State"
              value={state}
              onChange={setState}
              placeholder="NY"
              layout="vertical"
            />
            <TextField
              id="zipCode"
              label="Zip Code"
              value={zipCode}
              onChange={setZipCode}
              placeholder="10001"
              layout="vertical"
            />
          </div>
          <TextField
            id="country"
            label="Country"
            value={country}
            onChange={setCountry}
            placeholder="US"
          />
          <TextField
            id="phone"
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="(555) 123-4567"
          />
          <TextField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="contact@restaurant.com"
          />
        </CardContent>
      </Card>

      {/* Media */}
      <Card>
        <CardHeader>
          <CardTitle>Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            id="logoUrl"
            label="Logo URL"
            value={logoUrl}
            onChange={setLogoUrl}
            placeholder="https://..."
          />
          <TextField
            id="bannerUrl"
            label="Banner URL"
            value={bannerUrl}
            onChange={setBannerUrl}
            placeholder="https://..."
          />
        </CardContent>
      </Card>

      {/* Regional Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField
            id="currency"
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_OPTIONS}
          />
          <SelectField
            id="locale"
            label="Locale"
            value={locale}
            onChange={setLocale}
            options={LOCALE_OPTIONS}
          />
          <SelectField
            id="timezone"
            label="Timezone"
            value={timezone}
            onChange={setTimezone}
            options={TIMEZONE_OPTIONS}
          />
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessHoursEditor value={businessHours} onChange={setBusinessHours} />
        </CardContent>
      </Card>

      {/* Service Modes */}
      <Card>
        <CardHeader>
          <CardTitle>Service Modes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CheckboxField
            id="acceptsPickup"
            label="Pickup"
            checked={acceptsPickup}
            onChange={setAcceptsPickup}
            checkboxLabel="Accept pickup orders"
          />
          <CheckboxField
            id="acceptsDelivery"
            label="Delivery"
            checked={acceptsDelivery}
            onChange={setAcceptsDelivery}
            checkboxLabel="Accept delivery orders"
          />
          {acceptsDelivery && (
            <TextField
              id="deliveryRadius"
              label="Delivery Radius"
              type="number"
              value={deliveryRadius}
              onChange={setDeliveryRadius}
              placeholder="5"
              helperText="Maximum delivery distance in miles"
            />
          )}
          <PriceField
            id="minimumOrderAmount"
            label="Min Order"
            value={minimumOrderAmount}
            onChange={setMinimumOrderAmount}
          />
          <TextField
            id="estimatedPrepTime"
            label="Prep Time"
            type="number"
            value={estimatedPrepTime}
            onChange={setEstimatedPrepTime}
            placeholder="15"
            helperText="Estimated preparation time in minutes"
          />
        </CardContent>
      </Card>

      {/* Tip Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Tip Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <TipConfigEditor value={tipConfig} onChange={setTipConfig} />
        </CardContent>
      </Card>

      {/* Fee Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <FeeConfigEditor value={feeConfig} onChange={setFeeConfig} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/tenant")}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
