import React from "react";
import { Form, Input, Button, message, ConfigProvider } from "antd";
import { FaUserAlt, FaLock } from "react-icons/fa";
import pic1 from "../src/cbk 6.svg";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { loginUser } from "../src/api/auth";

/* ── decorative helpers ────────────────────────────── */
const GoldDivider = () => (
  <div className="flex items-center gap-3 w-48 my-5">
    <div className="h-px flex-1" style={{ background: "rgba(187,161,79,0.5)" }} />
    <div
      className="w-2 h-2 rotate-45"
      style={{ background: "#BBA14F", opacity: 0.75 }}
    />
    <div className="h-px flex-1" style={{ background: "rgba(187,161,79,0.5)" }} />
  </div>
);

const CornerBracket = ({ position }) => {
  const posClass = {
    tl: "top-5 left-5 border-t-2 border-l-2 rounded-tl-lg",
    br: "bottom-5 right-5 border-b-2 border-r-2 rounded-br-lg",
    tr: "top-5 right-5 border-t-2 border-r-2 rounded-tr-lg",
    bl: "bottom-5 left-5 border-b-2 border-l-2 rounded-bl-lg",
  }[position];
  return (
    <div
      className={`absolute w-12 h-12 border-[#BBA14F] opacity-50 ${posClass}`}
    />
  );
};
/* ─────────────────────────────────────────────────── */

const SalonLogin = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();

  const { mutate, isPending } = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      message.success("Logged in successfully, Welcome back!");
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      navigate("/");
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Unauthorized");
    },
  });

  const onFinish = (values) => mutate(values);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#BBA14F",
          colorBgContainer: "#FDFAF5",
          borderRadius: 10,
          colorBorder: "#d4c4a0",
          colorTextPlaceholder: "#b5a47a",
          fontFamily: "'Poppins', sans-serif",
        },
      }}
    >
      {/* ── Page Shell ── */}
      <div
        className="min-h-screen flex items-center justify-center p-4 sm:p-8"
        style={{ background: "linear-gradient(135deg, #ECE6DB 0%, #E0D4C0 100%)" }}
      >
        {/* ── Main Card ── */}
        <div
          className="w-full max-w-5xl flex overflow-hidden"
          style={{
            borderRadius: 24,
            border: "1px solid rgba(187,161,79,0.25)",
            boxShadow:
              "0 24px 80px rgba(39,39,39,0.14), 0 8px 32px rgba(187,161,79,0.10)",
            animation: "fadeIn 0.6s ease both",
          }}
        >
          {/* ════════════════════════════════
              LEFT — decorative panel
          ════════════════════════════════ */}
          <div
            className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden"
            style={{
              width: "52%",
              background: "linear-gradient(160deg, #1c1a15 0%, #272727 45%, #2e2318 100%)",
              animation: "fadeInLeft 0.7s ease 0.15s both",
            }}
          >
            {/* subtle dot-grid pattern */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                opacity: 0.6,
              }}
            />

            {/* radial glow accents */}
            <div
              className="absolute -top-24 -left-24 w-72 h-72 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(187,161,79,0.12), transparent 70%)",
              }}
            />
            <div
              className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(187,161,79,0.10), transparent 70%)",
              }}
            />

            {/* corner brackets */}
            <CornerBracket position="tl" />
            <CornerBracket position="br" />
            <CornerBracket position="tr" />
            <CornerBracket position="bl" />

            {/* ── centred content ── */}
            <div className="relative z-10 flex flex-col items-center text-center px-12">
              {/* logo ring */}
              <div
                className="flex items-center justify-center w-36 h-36 rounded-full mb-7"
                style={{
                  border: "2px solid rgba(187,161,79,0.55)",
                  background: "transparent",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.25), 0 0 0 6px rgba(255,255,255,0.07)",
                }}
              >
                <img src={pic1} alt="CBK Beauty" className="w-full h-full object-contain" />
              </div>

              {/* brand name */}
              <h1
                className="text-5xl font-bold mb-1 tracking-wide"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  color: "#BBA14F",
                  letterSpacing: "0.06em",
                }}
              >
                CBK
              </h1>
              <h2
                className="text-xl font-medium tracking-[0.35em] uppercase mb-1"
                style={{ fontFamily: "'Poppins', sans-serif", color: "#d4b96a" }}
              >
                Beauty
              </h2>

              <GoldDivider />

              {/* tagline */}
              <p
                className="text-base leading-relaxed mb-6 max-w-[260px]"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  color: "#E5D3B3",
                  fontStyle: "italic",
                  fontWeight: 400,
                  lineHeight: 1.75,
                }}
              >
                Where elegance meets artistry
              </p>

              {/* descriptor pills */}
              <div className="flex gap-3">
                {["Luxury", "Precision", "Beauty"].map((word) => (
                  <span
                    key={word}
                    className="text-[10px] tracking-[0.22em] uppercase px-3 py-1 rounded-full"
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      color: "#BBA14F",
                      border: "1px solid rgba(187,161,79,0.35)",
                      background: "rgba(187,161,79,0.07)",
                    }}
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════
              RIGHT — login form
          ════════════════════════════════ */}
          <div
            className="flex-1 flex flex-col justify-center px-8 py-12 sm:px-12"
            style={{
              background: "#FDFAF5",
              animation: "fadeInRight 0.7s ease 0.2s both",
            }}
          >
            {/* mobile logo */}
            <div className="flex justify-center mb-6 lg:hidden">
              <div
                className="flex items-center justify-center w-16 h-16 rounded-full"
                style={{ border: "1.5px solid rgba(187,161,79,0.4)", background: "rgba(187,161,79,0.06)" }}
              >
                <img src={pic1} alt="CBK Beauty" className="w-9 h-9 object-contain" />
              </div>
            </div>

            {/* heading */}
            <div
              className="mb-8"
              style={{ animation: "fadeInUp 0.55s ease 0.3s both" }}
            >
              <h2
                className="text-3xl font-semibold text-[#272727] mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Welcome back
              </h2>
              <p
                className="text-sm text-[#987554]"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Sign in to access your dashboard
              </p>
            </div>

            {/* thin gold accent line */}
            <div
              className="h-px w-10 mb-8 rounded-full"
              style={{ background: "#BBA14F", animation: "fadeIn 0.6s ease 0.4s both" }}
            />

            {/* form */}
            <Form
              layout="vertical"
              onFinish={onFinish}
              style={{ animation: "fadeInUp 0.55s ease 0.35s both" }}
            >
              <Form.Item
                label={
                  <span
                    className="text-sm font-medium text-[#272727]"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    Email Address
                  </span>
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
                  prefix={<FaUserAlt className="mr-1" style={{ color: "#BBA14F" }} />}
                  className="salon-input"
                />
              </Form.Item>

              <Form.Item
                label={
                  <span
                    className="text-sm font-medium text-[#272727]"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    Password
                  </span>
                }
                name="password"
                rules={[{ required: true, message: "Please enter your password" }]}
              >
                <Input.Password
                  size="large"
                  placeholder="••••••••"
                  prefix={<FaLock className="mr-1" style={{ color: "#BBA14F" }} />}
                  className="salon-input"
                />
              </Form.Item>

              {/* forgot password */}
              <div className="flex justify-end -mt-2 mb-5">
                {/* <span
                  className="text-sm text-[#987554] cursor-pointer"
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "#BBA14F")}
                  onMouseLeave={(e) => (e.target.style.color = "#987554")}
                >
                  Forgot password?
                </span> */}
              </div>

              <Form.Item className="mb-4">
                <Button
                  loading={isPending}
                  htmlType="submit"
                  block
                  className="salon-btn"
                >
                  Sign In
                </Button>
              </Form.Item>
            </Form>

            {/* sign up row */}
            {/* <p
              className="text-center text-sm text-[#272727] mt-2"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Don't have an account?{" "}
              <span
                className="font-medium cursor-pointer"
                style={{ color: "#BBA14F", transition: "opacity 0.2s" }}
                onMouseEnter={(e) => (e.target.style.opacity = "0.75")}
                onMouseLeave={(e) => (e.target.style.opacity = "1")}
              >
                Sign up
              </span>
            </p> */}

            {/* bottom brand tag */}
            <p
              className="text-center text-xs mt-8 tracking-widest uppercase"
              style={{
                fontFamily: "'Poppins', sans-serif",
                color: "rgba(152,117,84,0.45)",
                letterSpacing: "0.2em",
              }}
            >
              CBK Beauty · Est. 2018
            </p>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default SalonLogin;
