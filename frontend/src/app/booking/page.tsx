import Link from 'next/link';

export default function EventPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      {/* Hero Section */}
      <section className="w-full bg-[#f8f9fa] py-12 md:py-20 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
            {/* Ticket Graphic Placeholder */}
            <div className="w-full lg:w-1/2 flex justify-center lg:justify-start">
              <div className="relative w-full max-w-[600px] aspect-[2/1] bg-[#ff9b9b] rounded-xl border-4 border-dashed border-[#ff4d4d] flex overflow-hidden">
                {/* Cutouts */}
                <div className="absolute top-0 left-1/4 w-12 h-12 bg-[#f8f9fa] rounded-full -translate-y-1/2 -translate-x-1/2"></div>
                <div className="absolute bottom-0 left-1/4 w-12 h-12 bg-[#f8f9fa] rounded-full translate-y-1/2 -translate-x-1/2"></div>
              </div>
            </div>

            {/* Event Info */}
            <div className="w-full lg:w-1/2 flex flex-col items-start text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-4 tracking-tight">
                &lt;&lt; TITLE VÉ &gt;&gt;
              </h1>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-6">
                &lt;&lt;METADATA VÉ&gt;&gt;
              </p>
              <p className="text-base text-gray-600 mb-8 leading-relaxed max-w-xl">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
              <Link
                href="/booking/tickets"
                className="px-8 py-3.5 bg-[#0f1014] text-white rounded-xl font-bold text-base hover:bg-gray-800 transition-all duration-300 flex items-center justify-center min-w-[140px]"
              >
                Đặt vé
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Detail Section */}
      <section className="w-full bg-white py-16 md:py-32 flex-1">
        <div className="mx-auto max-w-[800px] px-4 sm:px-6 flex flex-col items-center">
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-12 text-center tracking-tight">
            &lt;&lt;TITLE CHI TIẾT EVENT&gt;&gt;
          </h2>

          <div className="text-gray-600 text-[15px] leading-relaxed space-y-8 text-left">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
