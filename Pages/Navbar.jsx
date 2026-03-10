import React from "react";
import { Input } from "antd";
import { FiSearch } from "react-icons/fi";

const Navbar = () => {
  return (
    
    <div className="h-[80px] flex items-center  justify-between px-8 shadow-sm border-b border-[#e5d3b3]">
      
      <h2 className="elegant-font text-2xl ">
        Dashboard
      </h2>

      <div className="flex items-center gap-6">
        <Input
          placeholder="Search..."
          prefix={<FiSearch className="text-[#987554]" />}
          className="rounded-full w-[250px]"
        />

        <div className="w-10 h-10 rounded-full bg-[#BBA14F] flex items-center justify-center text-white font-bold">
          E
        </div>
      </div>
    </div>
  );
};

export default Navbar;