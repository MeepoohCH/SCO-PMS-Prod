'use client'

import Image from 'next/image'
import dowLogoImg from '../../../public/dow-logo.png' 

export default function LoginBanner() {
  return (
    <header className="bg-[#0F2347] relative flex flex-col justify-between select-none font-sans w-full h-auto px-6 pt-10 pb-5 sm:px-10 sm:pb-8 text-center items-center lg:w-[40%] xl:w-[35%] lg:h-screen lg:p-12 xl:p-16 lg:text-left lg:items-start lg:justify-center border-b lg:border-b-0 lg:border-r border-white/10 shadow-xl">
      <div className="w-full max-w-[320px] sm:max-w-md lg:max-w-sm xl:max-w-md flex flex-col items-center lg:items-start">
        
        <div className="flex justify-center lg:justify-start mb-4 lg:mb-8 transition-transform hover:scale-105 duration-200 flex-shrink-0">
          <div className="w-[95px] sm:w-[110px] lg:w-[115px] h-auto flex items-center">
            <Image
              src={dowLogoImg} 
              alt="DOW Logo"
              priority 
              className="object-contain"
            />
          </div>
        </div>

        <p className="text-[11px] sm:text-xs font-bold text-[#E24B4A] uppercase tracking-widest mb-1.5 lg:mb-2">
          Welcome to
        </p>
        
        <h1 className="text-[22px] sm:text-[26px] lg:text-[28px] xl:text-[32px] font-black text-white leading-[1.2] tracking-wide">
          Packaging Management <span className="text-[#EF9F27]">System</span>
        </h1>
        
        <p className="mt-3.5 text-base sm:text-lg text-white/70 leading-relaxed font-medium">
           ระบบติดตามและควบคุมการบรรจุภัณฑ์
          </p>

      
       <div className="hidden lg:block mt-8 xl:mt-10 space-y-3 text-sm xl:text-base text-white/70 border-t border-white/10 pt-6 w-full">
  <div className="flex items-center gap-2.5">
    <span className="text-[#EF9F27] font-bold text-xs">✓</span>
    <span className="font-medium">วางแผนและจัดการบรรจุ</span>
  </div>
  <div className="flex items-center gap-2.5">
    <span className="text-[#EF9F27] font-bold text-xs">✓</span>
    <span className="font-medium">ตรวจสอบและติดตามสถานะแบบ Real-time</span>
  </div>
  <div className="flex items-center gap-2.5">
    <span className="text-[#EF9F27] font-bold text-xs">✓</span>
    <span className="font-medium">รายงานและวิเคราะห์ข้อมูล</span>
  </div>
</div>

      </div>
    </header>
  )
}