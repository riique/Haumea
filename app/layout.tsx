import type { Metadata } from "next";
import { 
  Inter, 
  Space_Grotesk, 
  Roboto, 
  Open_Sans, 
  Lato, 
  Merriweather,
  JetBrains_Mono,
  Fira_Code,
  Source_Code_Pro
} from 'next/font/google';
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { IndexedDBAlert } from "@/components/common/IndexedDBAlert";
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  weight: ['400', '600', '700'],
});

const roboto = Roboto({
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
  weight: ['400', '500', '700'],
});

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
});

const lato = Lato({
  subsets: ['latin'],
  variable: '--font-lato',
  display: 'swap',
  weight: ['400', '700'],
});

const merriweather = Merriweather({
  subsets: ['latin'],
  variable: '--font-merriweather',
  display: 'swap',
  weight: ['400', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
  display: 'swap',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Haumea",
  description: "Criado por @riiquestudies",
  icons: {
    icon: '/icon.ico',
    shortcut: '/icon.ico',
    apple: '/icon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="pt-BR" 
      className={`
        ${inter.variable} 
        ${spaceGrotesk.variable} 
        ${roboto.variable} 
        ${openSans.variable} 
        ${lato.variable} 
        ${merriweather.variable} 
        ${jetbrainsMono.variable} 
        ${firaCode.variable} 
        ${sourceCodePro.variable}
      `}
    >
      <body className="font-sans antialiased" style={{ fontFamily: 'var(--font-inter)' }}>
        <AuthProvider>
          <ThemeProvider>
            {children}
            <IndexedDBAlert />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
