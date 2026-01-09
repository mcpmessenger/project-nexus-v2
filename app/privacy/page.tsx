import Image from "next/image";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

export default function PrivacyPolicy() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl text-foreground relative">
            <div className="absolute top-4 right-4">
                <ModeToggle />
            </div>
            <div className="flex justify-center mb-8">
                <Link href="/">
                    <Image
                        src="https://automationalien.s3.us-east-1.amazonaws.com/ChatGPT+Image+Jun+23%2C+2025%2C+03_53_12+PM.png"
                        alt="Project Nexus Logo"
                        width={80}
                        height={80}
                        className="rounded-xl hover:opacity-90 transition-opacity"
                    />
                </Link>
            </div>
            <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
            <p className="mb-4 text-sm text-muted-foreground">Last Updated: January 8, 2026</p>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p className="mb-4">
                    Welcome to Project Nexus ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our workflow orchestration platform.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li><strong>Account Information:</strong> We collect your email address and basic profile information when you authenticate with Google or other providers.</li>
                    <li><strong>Usage Data:</strong> We collect information about how you interact with our platform, including workflow executions and tool usage.</li>
                    <li><strong>User Content:</strong> Data you input into the system, such as chat messages, documents, and configurations.</li>
                </ul>
            </section>

            <section className="mb-8 p-6 bg-muted/30 rounded-lg border border-border">
                <h2 className="text-2xl font-semibold mb-4">3. Google User Data</h2>
                <p className="mb-4">
                    Our application integrates with Google Workspace APIs to provide enhanced workflow automation. When you grant us permission, we may access the following Google user data:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li><strong>Gmail:</strong> To read, send, and manage emails as part of your automated workflows.</li>
                    <li><strong>Google Drive:</strong> To access, create, and manage files.</li>
                    <li><strong>Google Calendar:</strong> To manage events and schedules.</li>
                    <li><strong>Google Docs/Sheets/Slides:</strong> To create and edit content.</li>
                </ul>
                <p className="mb-4 font-semibold">
                    We do not share your Google user data with third-party tools (such as AI models) without your explicit consent. We do not sell your data.
                </p>
                <p>
                    Project Nexus's use and transfer to any other app of information received from Google APIs will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">4. How We Use Your Data</h2>
                <p className="mb-4">We use your information to:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Provide, maintain, and improve our services.</li>
                    <li>Process and complete your automated workflows.</li>
                    <li>Authenticate your identity and prevent fraud.</li>
                    <li>Communicate with you about updates and support.</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">5. Contact Us</h2>
                <p>
                    If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:greetings@automationalien.com" className="text-primary hover:underline">greetings@automationalien.com</a>
                </p>
            </section>
        </div>
    );
}
