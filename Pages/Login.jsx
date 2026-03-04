import React from "react";
import { Form, Input, Button, Checkbox } from "antd";
import { FaUserAlt, FaLock } from "react-icons/fa";
import { GiHairStrands } from "react-icons/gi";
import pic1 from '../src/9.svg'
import { useNavigate } from "react-router-dom";



const SalonLogin = ({setIsAuthenticated}) => {

  const navigate = useNavigate();

  const onFinish = (values) => {
    console.log("I am logged in");
    console.log(values);
     // mark as logged in
    setIsAuthenticated(true);

    // go to dashboard
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ECE6DB] px-4">
      <div
        className="
      w-full 
      max-w-md 
      bg-[#E5D3B3] 
      p-6 sm:p-8 md:p-10 
      rounded-2xl sm:rounded-3xl 
     
      shadow-xl
    "
      >
        {/* Icon */}
        <div className="flex justify-center  sm:mb-6">
          <div className=" w-28">
            
          <img src={pic1} alt="" />
          </div>

          {/* <GiHairStrands
            size={50}
            className="text-[#BBA14F] sm:w-[60px] sm:h-[60px]"
          /> */}
        </div>

        {/* Heading */}
        <h1
          className="
        text-2xl sm:text-3xl md:text-4xl 
        font-semibold 
        text-center 
        text-[#272727] 
        mb-2 
        font-['Playfair_Display']
      "
        >
          Welcome back
        </h1>

        <p className="text-center text-[#987554] mb-6 sm:mb-8 text-sm sm:text-base">
          Log in to your dashboard
        </p>

        {/* Ant Design Form */}
        <Form layout="vertical" onFinish={onFinish}>
          {/* Email */}
          <Form.Item
            label={
              <span className="text-[#272727] font-['Poppins']">Email</span>
            }
            name="email"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input
              size="large"
              placeholder="name@example.com"
              prefix={<FaUserAlt className="text-[#987554]" />}
              className="rounded-xl bg-[#ECE6DB] "
            />
          </Form.Item>

          {/* Password */}
          <Form.Item
            label={
              <span className="text-[#272727] font-['Poppins']">Password</span>
            }
            name="password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password
              size="large"
              placeholder="••••••••"
              prefix={<FaLock className="text-[#987554]" />}
              className="rounded-xl bg-[#ECE6DB]"
            />
          </Form.Item>

          {/* Forgot Password */}
          <div className="flex justify-end mb-4">
            <span className="text-sm text-[#987554] font-['Poppins'] hover:text-[#BBA14F] cursor-pointer transition">
              Forgot password?
            </span>
          </div>

          {/* Button */}
          <Form.Item>
            <Button
              htmlType="submit"
              block
              size="large"
              className="
            !bg-[#BBA14F] 
            hover:!bg-[#a89245] 
            !text-[#272727] 
            font-semibold 
            !rounded-xl 
            !border-none 
            h-[48px]
            
          "
            >
              Log In
            </Button>
          </Form.Item>
        </Form>

        {/* Sign Up */}
        <p className="text-center text-[#272727] mt-4 text-sm">
          Don't have an account?{" "}
          <span className="text-[#BBA14F] font-medium cursor-pointer">
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
};

export default SalonLogin;
