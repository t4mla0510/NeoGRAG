import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppClient from "./AppClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "REBot",
  description: "Trợ lý ảo hỗ trợ tra cứu và tư vấn quy chế đào tạo Trường Đại học Cần Thơ",
  icons: {
    icon: "/logo.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=K2D:ital,wght@0,100;0,400;0,700;1,400&family=Readex+Pro:ital,wght@0,300;0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppClient>{children}</AppClient>
      </body>
    </html>
  );
}
