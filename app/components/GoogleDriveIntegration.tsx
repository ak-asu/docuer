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
    // Check if user has connected Google Drive
    // This would typically check localStorage or make an API call
    const savedConnection = localStorage.getItem(
      `gdrive_connection_${userProfile.email}`,
    );
    if (savedConnection) {
      setStatus(JSON.parse(savedConnection));
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
        // Open OAuth page in new window
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const authWindow = window.open(
          data.authLink,
          "Google Drive Authorization",
          `width=${width},height=${height},left=${left},top=${top}`,
        );

        // Poll for window close or success
        const checkWindow = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkWindow);
            checkConnectionStatus(data.connectionId);
          }
        }, 1000);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to Google Drive",
      );
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async (connectionId: string) => {
    try {
      // Check if connection was successful
      // In practice, this would poll an API endpoint
      setTimeout(() => {
        const newStatus = {
          connected: true,
          email: userProfile.email,
          connectedAt: new Date().toISOString(),
        };
        setStatus(newStatus);
        localStorage.setItem(
          `gdrive_connection_${userProfile.email}`,
          JSON.stringify(newStatus),
        );
      }, 2000);
    } catch (err) {
      setError("Failed to verify connection");
    }
  };

  const handleDisconnect = () => {
    setStatus({ connected: false });
    localStorage.removeItem(`gdrive_connection_${userProfile.email}`);
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
              <Button
                color="danger"
                variant="flat"
                startContent={<X size={18} />}
                onPress={handleDisconnect}
              >
                Disconnect
              </Button>
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
