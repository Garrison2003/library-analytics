interface UploadProps {
  onBackHome: () => void;
}

export default function Upload({ onBackHome }: UploadProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Upload</h1>
      <p className="text-gray-500 mb-8">This page is under construction.</p>
      <button
        onClick={onBackHome}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Back to Home
      </button>
    </div>
  );
}
