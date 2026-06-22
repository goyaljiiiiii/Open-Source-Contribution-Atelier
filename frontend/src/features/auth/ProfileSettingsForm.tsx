import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { fetchApi } from "../../lib/api";
import { useAuth } from "./AuthContext";
import { useToast } from "../ui/ToastContext";

const profileSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .optional()
    .transform((val) => (val === "" ? undefined : val))
    .refine((val) => !val || val.length >= 8, {
      message: "Password must be at least 8 characters long if provided",
    }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileSettingsForm() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: user?.email || "",
      password: "",
    },
  });

  useEffect(() => {
    if (user?.email) {
      reset({ email: user.email, password: "" });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileFormValues) => {
    setLoading(true);

    try {
      // Create payload dynamically, omitting undefined fields like empty password
      const payload: Record<string, string> = { email: data.email };
      if (data.password) {
        payload.password = data.password;
      }

      await fetchApi("/auth/me/", {
        method: "PUT",
        requireAuth: true,
        body: JSON.stringify(payload),
      });
      
      addToast("Profile settings updated successfully!", "success");
      reset({ email: data.email, password: "" });
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to update profile settings.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-6 pt-2" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">
          Email Address
        </label>
        <input
          {...register("email")}
          className={`w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-accent shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card ${
            errors.email ? "border-red-500" : ""
          }`}
          type="email"
          placeholder="nerd@homework.com"
          disabled={loading}
        />
        {errors.email && (
          <p className="text-red-600 font-bold ml-2 text-sm">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="font-bold text-black ml-2 uppercase tracking-wide text-sm">
          New Password (leave blank to keep current)
        </label>
        <input
          {...register("password")}
          className={`w-full rounded-2xl border-4 border-black bg-white px-5 py-4 text-black font-bold outline-none placeholder:text-muted/60 focus:bg-tertiary shadow-card-sm transition-all focus:-translate-y-1 focus:shadow-card ${
            errors.password ? "border-red-500" : ""
          }`}
          type="password"
          placeholder="••••••••"
          disabled={loading}
        />
        {errors.password && (
          <p className="text-red-600 font-bold ml-2 text-sm">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        className="w-full rounded-2xl border-4 border-black bg-accent px-5 py-5 font-black text-black text-xl shadow-card hover:bg-tertiary transition-colors cursor-pointer mt-4 uppercase disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Updating..." : "Save Settings"}
      </button>
    </form>
  );
}
