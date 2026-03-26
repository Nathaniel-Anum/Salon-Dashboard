import React from "react";
import { GiHairStrands } from "react-icons/gi";
import pic1 from '../src/9.svg'
import pic2 from '../src/cbk.png'
import pic3 from '../src/image.png'


const SalonLoader = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#ECE6DB]">
      
      {/* Icon */}
      {/* <GiHairStrands className="text-[#BBA14F] text-7xl animate-pulse" /> */}

        <div className=" w-20">
                  
                {/* <img src={pic1} alt="" /> */}
                <img src={pic3} alt="" />
                </div>

      {/* Custom Loading Line */}
      <div className="mt-6 w-40 h-1 bg-[#E5D3B3] rounded-full overflow-hidden">
        <div className="h-full bg-[#BBA14F] animate-loadingBar"></div>
      </div>

      {/* Loading Text */}
      <p className="mt-4 text-[#987554] tracking-widest text-sm">
        Loading...
      </p>
    </div>
  );
};

export default SalonLoader;