import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center" dir="rtl">
          <div className="text-center max-w-md">
            <img src="/Logo.png" alt="نبغة" className="w-24 h-24 object-contain mx-auto mb-6 opacity-50" />
            <h1 className="text-2xl font-bold text-[#0E3B2E] mb-2">حدث خطأ غير متوقع</h1>
            <p className="text-gray-500 text-sm mb-6">نعتذر عن هذا الخطأ. يرجى تحديث الصفحة أو المحاولة مرة أخرى.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#0E3B2E] hover:bg-[#1F6B4E] text-white font-medium px-6 py-3 rounded-xl text-sm transition-all"
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
