
import React from 'react';

export default function TermsOfService() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl text-foreground">
            <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
            <p className="mb-4 text-sm text-muted-foreground">Last Updated: January 8, 2026</p>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p className="mb-4">
                    By accessing or using Project Nexus, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
                <p className="mb-4">
                    Project Nexus is an intelligent workflow orchestration platform that allows users to automate tasks across various services using AI and traditional integrations.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">3. User Responsibilities</h2>
                <p className="mb-4">
                    You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree not to use the service for any illegal or unauthorized purpose.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">4. API Usage and Limits</h2>
                <p className="mb-4">
                    You agree to comply with all applicable third-party terms (e.g., Google, GitHub) when using our integrations. Excessive use or abuse of API limits may result in temporary or permanent suspension of your access.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">5. Disclaimer of Warranties</h2>
                <p className="mb-4">
                    The service is provided "as is" and "as available" without any warranties of any kind, whether express or implied.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">6. Limitation of Liability</h2>
                <p className="mb-4">
                    In no event shall Project Nexus be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the service.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">7. Contact</h2>
                <p>
                    Questions about the Terms of Service should be sent to us at: <a href="mailto:greetings@automationalien.com" className="text-primary hover:underline">greetings@automationalien.com</a>
                </p>
            </section>
        </div>
    );
}
