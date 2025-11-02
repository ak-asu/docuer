"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
  Spinner,
  Input,
} from "@heroui/react";
import { Folder, FileText, Search, ChevronRight } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  children?: DriveFile[];
}

interface GoogleDriveFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFiles: (fileIds: string[]) => void;
  useDummyData?: boolean;
}

export default function GoogleDriveFilePicker({
  isOpen,
  onClose,
  onSelectFiles,
  useDummyData = false,
}: GoogleDriveFilePickerProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen]);

  const fetchFiles = async (folderId?: string) => {
    setLoading(true);
    try {
      // If using dummy data, skip API call and use mock data directly
      if (useDummyData) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        setFiles(mockDriveFiles);
        setLoading(false);
        return;
      }

      // This would call the Google Drive API via your backend
      const response = await fetch(
        `/api/integrations/google-drive/files${folderId ? `?folderId=${folderId}` : ""}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      // Mock data for demonstration
      setFiles(mockDriveFiles);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFileIds);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFileIds(newSelected);
  };

  const selectAllInFolder = (folder: DriveFile, select: boolean) => {
    const newSelected = new Set(selectedFileIds);
    const processFolder = (item: DriveFile) => {
      if (!item.isFolder) {
        if (select) {
          newSelected.add(item.id);
        } else {
          newSelected.delete(item.id);
        }
      }
      if (item.children) {
        item.children.forEach(processFolder);
      }
    };
    processFolder(folder);
    setSelectedFileIds(newSelected);
  };

  const handleSubmit = () => {
    onSelectFiles(Array.from(selectedFileIds));
    onClose();
  };

  const filterFiles = (items: DriveFile[], query: string): DriveFile[] => {
    if (!query) return items;

    return items
      .map((item) => {
        if (item.name.toLowerCase().includes(query.toLowerCase())) {
          return item;
        }
        if (item.children) {
          const filteredChildren = filterFiles(item.children, query);
          if (filteredChildren.length > 0) {
            return { ...item, children: filteredChildren };
          }
        }
        return null;
      })
      .filter((item): item is DriveFile => item !== null);
  };

  const renderFileTree = (items: DriveFile[], level: number = 0) => {
    const filteredItems = searchQuery ? filterFiles(items, searchQuery) : items;

    return (
      <div className="space-y-1">
        {filteredItems.map((item) => {
          const isExpanded = expandedFolders.has(item.id);
          const isSelected = selectedFileIds.has(item.id);
          const hasSelectedChildren =
            item.children?.some((child) => selectedFileIds.has(child.id)) ||
            false;

          return (
            <div key={item.id}>
              <div
                className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                }`}
                style={{ paddingLeft: `${level * 24 + 8}px` }}
              >
                {item.isFolder && (
                  <button
                    onClick={() => toggleFolder(item.id)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <ChevronRight
                      size={16}
                      className={`transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                )}

                <div className="flex items-center gap-2 flex-1">
                  {item.isFolder ? (
                    <Folder
                      size={20}
                      className={
                        hasSelectedChildren ? "text-blue-500" : "text-gray-500"
                      }
                    />
                  ) : (
                    <FileText size={20} className="text-gray-500" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
                    {item.name}
                  </span>
                </div>

                {item.isFolder ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => selectAllInFolder(item, true)}
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => selectAllInFolder(item, false)}
                    >
                      Deselect All
                    </Button>
                  </div>
                ) : (
                  <Checkbox
                    isSelected={isSelected}
                    onValueChange={() => toggleFileSelection(item.id)}
                  />
                )}
              </div>

              {item.isFolder && isExpanded && item.children && (
                <div className="mt-1">
                  {renderFileTree(item.children, level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">
                Select Documents from Google Drive
              </h2>
              {useDummyData && (
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                  Demo Mode
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Choose documents to include in your course
            </p>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search size={18} />}
              isClearable
              onClear={() => setSearchQuery("")}
            />

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
                <p className="ml-3 text-gray-600">Loading your files...</p>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                {files.length > 0 ? (
                  renderFileTree(files)
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>No files found</p>
                    <p className="text-sm">
                      Make sure you&apos;ve connected your Google Drive account
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedFileIds.size > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {selectedFileIds.size} file
                  {selectedFileIds.size !== 1 ? "s" : ""} selected
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isDisabled={selectedFileIds.size === 0}
          >
            Add Selected Files ({selectedFileIds.size})
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Mock data for demonstration
const mockDriveFiles: DriveFile[] = [
  {
    id: "folder1",
    name: "Technical Documentation",
    mimeType: "application/vnd.google-apps.folder",
    isFolder: true,
    children: [
      {
        id: "file1",
        name: "API Reference.pdf",
        mimeType: "application/pdf",
        isFolder: false,
      },
      {
        id: "file2",
        name: "Getting Started Guide.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isFolder: false,
      },
      {
        id: "subfolder1",
        name: "Advanced Topics",
        mimeType: "application/vnd.google-apps.folder",
        isFolder: true,
        children: [
          {
            id: "file3",
            name: "Authentication.md",
            mimeType: "text/markdown",
            isFolder: false,
          },
          {
            id: "file4",
            name: "Rate Limiting.md",
            mimeType: "text/markdown",
            isFolder: false,
          },
        ],
      },
    ],
  },
  {
    id: "folder2",
    name: "Tutorials",
    mimeType: "application/vnd.google-apps.folder",
    isFolder: true,
    children: [
      {
        id: "file5",
        name: "Quick Start Tutorial.pdf",
        mimeType: "application/pdf",
        isFolder: false,
      },
      {
        id: "file6",
        name: "Best Practices.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isFolder: false,
      },
    ],
  },
  {
    id: "file7",
    name: "README.md",
    mimeType: "text/markdown",
    isFolder: false,
  },
];
