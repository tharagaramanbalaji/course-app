import React, { useRef } from "react";
import { createPortal } from "react-dom";

export default function CertificateModal({
  isOpen,
  onClose,
  certificate,
  onDownloadText,
  isDownloadingText = false,
}) {
  const certRef = useRef(null);

  if (!isOpen || !certificate) return null;

  const formattedDate = certificate.completionDate
    ? new Date(certificate.completionDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Recently Completed";

  const handlePrint = () => {
    window.print();
  };

  const handleCopyId = () => {
    if (certificate.certificateNumber) {
      navigator.clipboard.writeText(certificate.certificateNumber);
      alert(`Certificate ID ${certificate.certificateNumber} copied to clipboard!`);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-slate-900/80 p-4 backdrop-blur-sm animate-fadeIn">
      {/* Print Stylesheet injection to print ONLY the certificate */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-certificate, #printable-certificate * {
            visibility: visible;
          }
          #printable-certificate {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            margin: 0;
            padding: 24px;
            box-sizing: border-box;
            background: white !important;
            border: 12px double #0A6847 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900/90 p-4 sm:p-6 shadow-2xl transition-all my-8 max-h-[92vh] flex flex-col border border-slate-700/60 z-[151]">
        {/* Modal Controls Header */}
        <div className="no-print flex items-center justify-between pb-3 border-b border-slate-700/80">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              🎓
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Official Certificate of Completion</h3>
              <p className="text-[11px] text-slate-400">Verified digital credential</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Save as PDF / Print</span>
            </button>

            {onDownloadText && (
              <button
                type="button"
                onClick={onDownloadText}
                disabled={isDownloadingText}
                className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition flex items-center gap-1"
                title="Download raw signature record"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{isDownloadingText ? "Downloading..." : ".TXT Record"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Certificate Display Card */}
        <div className="flex-1 overflow-y-auto py-4">
          <div
            id="printable-certificate"
            ref={certRef}
            className="relative mx-auto rounded-xl bg-gradient-to-b from-[#FAFBF8] to-[#F3F6F0] p-8 sm:p-12 text-center text-slate-900 shadow-xl border-8 border-double border-[#0A6847]"
          >
            {/* Corner Ornamental Accents */}
            <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-[#D4AF37]" />
            <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-[#D4AF37]" />
            <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-[#D4AF37]" />
            <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-[#D4AF37]" />

            {/* Header / Seal */}
            <div className="flex flex-col items-center space-y-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#0A6847] to-[#7ABA78] text-white shadow-md">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
                </svg>
              </div>

              <span className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#0A6847]">
                LearnFlow Academy &bull; Certificate of Achievement
              </span>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-slate-900 tracking-tight">
                Certificate of Completion
              </h1>
            </div>

            {/* Body */}
            <div className="mt-8 space-y-4">
              <p className="text-xs sm:text-sm uppercase tracking-widest text-slate-500 font-medium">
                This is proudly presented to
              </p>
              
              <div className="py-2">
                <h2 className="text-2xl sm:text-4xl font-serif font-extrabold text-[#063F2A] border-b-2 border-[#D4AF37]/50 inline-block px-8 pb-1">
                  {certificate.participantName || "Learner"}
                </h2>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                for successfully completing all curriculum modules, multimedia training, and passing required assessments for
              </p>

              <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 max-w-xl mx-auto">
                {certificate.courseName || "Training Course"}
              </h3>
            </div>

            {/* Footer Details */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200/80 items-end">
              <div className="text-center sm:text-left">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Date of Completion
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-800">
                  {formattedDate}
                </span>
              </div>

              <div className="text-center">
                <div className="inline-flex flex-col items-center">
                  <div className="h-10 w-24 border-b border-slate-400 flex items-end justify-center pb-1">
                    <span className="font-serif italic text-sm font-bold text-[#0A6847]">LearnFlow Verified</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1">
                    Academic Director
                  </span>
                </div>
              </div>

              <div className="text-center sm:text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Final Mastery Score
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700">
                  {certificate.finalScore}%
                </span>
              </div>
            </div>

            {/* Verification Bar */}
            <div className="mt-6 pt-3 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Certificate ID: <strong>{certificate.certificateNumber}</strong></span>
              <button
                type="button"
                onClick={handleCopyId}
                className="no-print text-[#0A6847] hover:underline font-sans font-semibold cursor-pointer"
              >
                Copy ID 📋
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
