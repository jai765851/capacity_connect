import React, { useState } from 'react';
import { Building2, Mail, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SelectField, TextField, TextareaField } from '../../components/ui/FormField';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { databaseService } from '../../services/databaseService';
import { InquiryCategory } from '../../types/competency';

export function ContactPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [inquiryType, setInquiryType] = useState<InquiryCategory>('Institutional Onboarding');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitResult, setSubmitResult] = useState<{
    tone: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Enter a valid official email address.';
    }
    if (!organisation.trim()) nextErrors.organisation = 'Department or organisation name is required.';
    if (message.trim().length < 15) {
      nextErrors.message = 'Provide at least 15 characters describing your inquiry.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const confirmationMsg = await databaseService.submitContactInquiry({
        fullName: fullName.trim(),
        email: email.trim(),
        organisation: organisation.trim(),
        inquiryType,
        message: message.trim(),
      });
      setSubmitResult({
        tone: 'success',
        title: 'Inquiry Submitted',
        description: `${confirmationMsg} Reference submitted for ${organisation.trim()}.`,
      });
      setFullName('');
      setEmail('');
      setOrganisation('');
      setMessage('');
    } catch (err) {
      setSubmitResult({
        tone: 'error',
        title: 'Submission Failed',
        description: err instanceof Error ? err.message : 'Unable to record inquiry right now.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-full">
      <section className="bg-white border-b border-slate-200 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <p className="font-mono text-xs font-medium text-[#0F766E]">
            Coordination &amp; Support Desk
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0B1F3A] tracking-tight">
            Institutional Onboarding &amp; Technical Contact
          </h1>
          <p className="text-base text-slate-600 max-w-2xl leading-relaxed">
            Reach out to coordinate departmental competency framework deployment, trainer account
            nominations, or portal governance queries.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-6">
              <Card className="p-6 space-y-5">
                <h2 className="font-display text-lg font-semibold text-[#0B1F3A]">
                  Programme Management Channels
                </h2>
                <div className="space-y-4 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-[#0F766E] mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">
                        Capacity Building Directorate (SIH26075)
                      </p>
                      <p className="mt-0.5">
                        Organisational Competency Standards &amp; Departmental Rollout Cell
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-[#0F766E] mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">Coordination Email</p>
                      <p className="font-mono text-xs mt-0.5">
                        support@capacityconnect.gov.in
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#0F766E] mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">Portal Operations Hours</p>
                      <p className="mt-0.5">Monday – Friday, 09:30 to 18:00 IST</p>
                    </div>
                  </div>
                </div>
              </Card>

              <StatusBanner
                tone="info"
                title="Administrative Routing"
                description="Submitted inquiries are stored in PostgreSQL notifications scoped to active portal Administrators for departmental follow-up."
              />
            </div>

            <div className="lg:col-span-7">
              <Card className="p-6 sm:p-8 space-y-6">
                <h2 className="font-display text-xl font-semibold text-[#0B1F3A]">
                  Submit an Institutional Inquiry
                </h2>

                {submitResult && (
                  <StatusBanner
                    tone={submitResult.tone}
                    title={submitResult.title}
                    description={submitResult.description}
                  />
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <TextField
                      htmlFor="contact-name"
                      label="Full Name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      error={errors.fullName}
                      placeholder="e.g. Rajeshwari Menon"
                    />
                    <TextField
                      htmlFor="contact-email"
                      label="Official Email Address"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      error={errors.email}
                      placeholder="name@department.gov.in"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <TextField
                      htmlFor="contact-org"
                      label="Department / Organisation"
                      required
                      value={organisation}
                      onChange={(e) => setOrganisation(e.target.value)}
                      error={errors.organisation}
                      placeholder="e.g. State Finance Directorate"
                    />
                    <SelectField
                      htmlFor="contact-type"
                      label="Inquiry Category"
                      required
                      value={inquiryType}
                      onChange={(e) => setInquiryType(e.target.value as InquiryCategory)}
                    >
                      <option value="Institutional Onboarding">Institutional Onboarding</option>
                      <option value="Competency Framework Design">
                        Competency Framework Design
                      </option>
                      <option value="Trainer Nomination">Trainer Nomination</option>
                      <option value="Technical Integration">Technical Integration</option>
                    </SelectField>
                  </div>

                  <TextareaField
                    htmlFor="contact-message"
                    label="Inquiry Details"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    error={errors.message}
                    placeholder="Outline your department's role structure, training scope, or technical questions..."
                  />

                  <div className="pt-2 flex justify-end">
                    <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
                      {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
