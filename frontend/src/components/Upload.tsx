import { useState } from "react";
import {
  FILE_CONFIGURATIONS,
  getAvailableFileTypes,
  getFileConfigByExtension,
  formatFileSize,
  type FileTypeConfig,
} from "../config/fileConfig";
import { apiClient } from "../services/api";

interface UploadProps {
  onBackHome: () => void;
}

interface UploadState {
  selectedFileType: FileTypeConfig | null;
  selectedFile: File | null;
  isDragging: boolean;
  isValidating: boolean;
  isUploading: boolean;
  validationError: string | null;
  validationWarnings: string[];
  uploadSuccess: boolean;
  uploadError: string | null;
  uploadProgress: number;
}

export default function Upload({ onBackHome }: UploadProps) {
  const [state, setState] = useState<UploadState>({
    selectedFileType: null,
    selectedFile: null,
    isDragging: false,
    isValidating: false,
    isUploading: false,
    validationError: null,
    validationWarnings: [],
    uploadSuccess: false,
    uploadError: null,
    uploadProgress: 0,
  });

  const availableFileTypes = getAvailableFileTypes();

  // Handle file type selection
  const handleFileTypeSelect = (fileType: FileTypeConfig) => {
    setState((prev) => ({
      ...prev,
      selectedFileType: fileType,
      selectedFile: null,
      validationError: null,
      validationWarnings: [],
      uploadSuccess: false,
      uploadError: null,
    }));
  };

  // Handle file selection from input
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    await validateAndSetFile(file);
  };

  // Validate and set file
  const validateAndSetFile = async (file: File) => {
    setState((prev) => ({
      ...prev,
      isValidating: true,
      validationError: null,
      validationWarnings: [],
      uploadSuccess: false,
      uploadError: null,
    }));

    try {
      // Check if file type matches selected
      if (state.selectedFileType) {
        const config = getFileConfigByExtension(file.name);
        if (!config || config.id !== state.selectedFileType.id) {
          setState((prev) => ({
            ...prev,
            isValidating: false,
            validationError: `File type does not match selected type. Expected ${state.selectedFileType?.displayName}.`,
          }));
          return;
        }
      }

      // Run custom validation if available
      const fileConfig =
        state.selectedFileType || getFileConfigByExtension(file.name);
      if (!fileConfig) {
        setState((prev) => ({
          ...prev,
          isValidating: false,
          validationError: "Unsupported file type. Please select a valid file.",
        }));
        return;
      }

      if (fileConfig.validate) {
        const validationResult = await fileConfig.validate(file);

        if (!validationResult.valid) {
          setState((prev) => ({
            ...prev,
            isValidating: false,
            validationError: validationResult.error || "File validation failed",
            validationWarnings: validationResult.warnings || [],
          }));
          return;
        }

        if (validationResult.warnings) {
          setState((prev) => ({
            ...prev,
            isValidating: false,
            selectedFile: file,
            validationWarnings: validationResult.warnings,
            validationError: null,
          }));
          return;
        }
      }

      setState((prev) => ({
        ...prev,
        selectedFile: file,
        isValidating: false,
        validationError: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isValidating: false,
        validationError:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during validation",
      }));
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, isDragging: true }));
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, isDragging: false }));
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, isDragging: false }));

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await validateAndSetFile(files[0]);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!state.selectedFile) {
      setState((prev) => ({
        ...prev,
        uploadError: "Please select a file to upload",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isUploading: true,
      uploadError: null,
      uploadProgress: 0,
    }));

    try {
      const response = await apiClient.uploadFile(state.selectedFile, {
        fileType: state.selectedFileType?.id,
      });

      if (response.success) {
        setState((prev) => ({
          ...prev,
          isUploading: false,
          uploadSuccess: true,
          uploadProgress: 100,
          selectedFile: null,
          selectedFileType: null,
        }));

        // Reset form after 3 seconds
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            uploadSuccess: false,
          }));
        }, 3000);
      } else {
        setState((prev) => ({
          ...prev,
          isUploading: false,
          uploadError:
            response.error?.message || "Upload failed. Please try again.",
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isUploading: false,
        uploadError:
          error instanceof Error
            ? error.message
            : "An error occurred during upload",
      }));
    }
  };

  // Clear selection
  const handleClear = () => {
    setState((prev) => ({
      ...prev,
      selectedFile: null,
      selectedFileType: null,
      validationError: null,
      validationWarnings: [],
      uploadError: null,
      uploadSuccess: false,
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Upload Data Files
        </h1>
        <p className="text-gray-600">
          Select a file type and upload your data for processing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Type Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              File Type
            </h2>
            <div className="space-y-3">
              {availableFileTypes.map((fileType) => (
                <button
                  key={fileType.id}
                  onClick={() => handleFileTypeSelect(fileType)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    state.selectedFileType?.id === fileType.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-gray-900">
                    {fileType.displayName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {fileType.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-8">
            {/* File Type Help */}
            {state.selectedFileType && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">
                  {state.selectedFileType.displayName}
                </h3>
                {state.selectedFileType.helpText && (
                  <p className="text-sm text-blue-800">
                    {state.selectedFileType.helpText}
                  </p>
                )}
                <div className="mt-3 text-sm text-blue-700">
                  <div>
                    <strong>Formats:</strong>{" "}
                    {state.selectedFileType.allowedExtensions
                      .map((ext) => `.${ext}`)
                      .join(", ")}
                  </div>
                  <div>
                    <strong>Max Size:</strong>{" "}
                    {formatFileSize(state.selectedFileType.maxSizeBytes)}
                  </div>
                </div>
              </div>
            )}

            {/* Drag and Drop Area */}
            {!state.selectedFile && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  state.isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="mb-4">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V16a4 4 0 00-4-4h-8l-4-4z"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drag and drop your file here
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  or click to select from your computer
                </p>

                <label className="inline-block">
                  <input
                    type="file"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                    accept={
                      state.selectedFileType
                        ? state.selectedFileType.acceptedMimeTypes.join(",")
                        : ".xlsm,.xlsx,.pdf"
                    }
                  />
                  <span className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                    Select File
                  </span>
                </label>
              </div>
            )}

            {/* Validation Loading */}
            {state.isValidating && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-600">Validating file...</span>
              </div>
            )}

            {/* Validation Error */}
            {state.validationError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Validation Error
                    </h3>
                    <p className="mt-2 text-sm text-red-700">
                      {state.validationError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Warnings */}
            {state.validationWarnings.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Warnings
                    </h3>
                    <ul className="mt-2 list-disc list-inside text-sm text-yellow-700">
                      {state.validationWarnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Selected File Display */}
            {state.selectedFile && (
              <div className="mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-green-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="font-medium text-green-800">
                        {state.selectedFile.name}
                      </h3>
                      <p className="mt-1 text-sm text-green-700">
                        Size: {formatFileSize(state.selectedFile.size)}
                      </p>
                    </div>
                    {!state.isUploading && (
                      <button
                        onClick={handleClear}
                        className="text-green-600 hover:text-green-800 font-medium text-sm"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Upload Error */}
            {state.uploadError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Upload Failed
                    </h3>
                    <p className="mt-2 text-sm text-red-700">
                      {state.uploadError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Success */}
            {state.uploadSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-green-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Upload Successful!
                    </h3>
                    <p className="mt-2 text-sm text-green-700">
                      Your file has been uploaded and is being processed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {state.isUploading && (
              <div className="mb-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${state.uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="ml-3 text-sm text-gray-600">
                    {state.uploadProgress}%
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {state.selectedFile && !state.isUploading && (
                <button
                  onClick={handleUpload}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upload File
                </button>
              )}
              <button
                onClick={onBackHome}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
