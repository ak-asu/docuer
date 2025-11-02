"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Button, Spinner } from "@heroui/react";
import { motion } from "framer-motion";
import { Cloud, Check, X, AlertCircle } from "lucide-react";
import { useStore } from "@/lib/store/useStore";

interface ConnectionStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export default function GoogleDriveIntegration() {
  const { userProfile } = useStore();
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check connection status from API
    const checkStatus = async () => {
      if (!userProfile.email) return;

      try {
        const response = await fetch(
          `/api/integrations/google-drive/connections?userId=${encodeURIComponent(userProfile.email)}`,
        );

        if (response.ok) {
          const data = await response.json();
          if (data.connections && data.connections.length > 0) {
            const conn = data.connections[0];
            setStatus({
              connected: true,
              email: conn.email,
              connectedAt: conn.createdAt,
            });
          }
        }
      } catch (err) {
        console.error("Failed to check connection status:", err);
      }
    };

    // Check for OAuth callback success
    const urlParams = new URLSearchParams(window.location.search);
    const gdriveConnected = urlParams.get("gdrive_connected");
    const gdriveError = urlParams.get("gdrive_error");

    if (gdriveConnected === "true") {
      // Remove connecting flag
      localStorage.removeItem("gdrive_connecting");
      // Check status after successful callback
      checkStatus();
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (gdriveError) {
      setError(
        decodeURIComponent(gdriveError) || "Failed to connect Google Drive",
      );
      localStorage.removeItem("gdrive_connecting");
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Normal status check
      checkStatus();
    }
  }, [userProfile.email]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      // Initiate OAuth flow
      const response = await fetch("/api/integrations/google-drive/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userProfile.email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate Google Drive connection");
      }

      const data = await response.json();

      if (data.authLink) {
        // Store connection attempt in localStorage for callback handling
        localStorage.setItem(
          "gdrive_connecting",
          JSON.stringify({
            userId: userProfile.email,
            timestamp: Date.now(),
          }),
        );

        // Redirect to OAuth page directly (avoids COOP issues)
        window.location.href = data.authLink;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to Google Drive",
      );
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);

    try {
      // Delete the connection using userId
      const deleteResponse = await fetch(
        `/api/integrations/google-drive/connections?userId=${encodeURIComponent(userProfile.email)}`,
        { method: "DELETE" },
      );

      if (deleteResponse.ok) {
        setStatus({ connected: false });
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Cloud className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Google Drive
              </h3>
              <p className="text-sm text-gray-600">
                Connect to import documents for learning
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
              <AlertCircle size={20} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {status.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <Check size={20} />
                <p className="font-medium">Connected to Google Drive</p>
              </div>
              {status.email && (
                <p className="text-sm text-gray-600">Account: {status.email}</p>
              )}
              {status.connectedAt && (
                <p className="text-sm text-gray-500">
                  Connected on{" "}
                  {new Date(status.connectedAt).toLocaleDateString()}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  color="danger"
                  variant="flat"
                  startContent={<X size={18} />}
                  onPress={handleDisconnect}
                  isDisabled={loading}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Connect your Google Drive to easily import documents and create
                courses from your files. We use OAuth for secure,
                permission-based access.
              </p>
              <Button
                color="primary"
                startContent={
                  loading ? <Spinner size="sm" /> : <Cloud size={18} />
                }
                onPress={handleConnect}
                isDisabled={loading}
              >
                {loading ? "Connecting..." : "Connect Google Drive"}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}
