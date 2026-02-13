import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import type { CaptureFormField, CaptureFormSettings } from '@/types/captureForms';

interface PublicFormRendererProps {
  fields: CaptureFormField[];
  settings: CaptureFormSettings;
  formName: string;
  onSubmit: (answers: Record<string, unknown>) => Promise<void>;
}

export function PublicFormRenderer({ fields, settings, formName, onSubmit }: PublicFormRendererProps) {
  const [step, setStep] = useState(-1); // -1 = welcome, fields.length = thank you
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const primaryColor = settings.primary_color || '#6366f1';
  const isWelcome = step === -1;
  const isThankYou = done;
  const currentField = !isWelcome && !isThankYou ? fields[step] : null;

  const setValue = (fieldId: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  const canProceed = () => {
    if (!currentField) return true;
    if (!currentField.required) return true;
    const val = answers[currentField.id];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  };

  const next = async () => {
    if (isWelcome) {
      setStep(0);
      return;
    }
    if (step < fields.length - 1) {
      setStep(step + 1);
    } else {
      setSubmitting(true);
      try {
        await onSubmit(answers);
        setDone(true);
      } catch {
        // error handled upstream
      } finally {
        setSubmitting(false);
      }
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
    else if (step === 0) setStep(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canProceed() && !submitting) {
      e.preventDefault();
      next();
    }
  };

  const renderField = (field: CaptureFormField) => {
    const val = answers[field.id];
    switch (field.type) {
      case 'short_text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
            value={(val as string) || ''}
            onChange={e => setValue(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            className="text-lg py-6 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-current"
            style={{ borderColor: primaryColor }}
            autoFocus
            onKeyDown={handleKeyDown}
          />
        );
      case 'long_text':
        return (
          <Textarea
            value={(val as string) || ''}
            onChange={e => setValue(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            className="text-lg border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 resize-none"
            style={{ borderColor: primaryColor }}
            rows={4}
            autoFocus
          />
        );
      case 'single_select':
        return (
          <div className="space-y-3">
            {(field.options || []).map((opt, i) => (
              <button
                key={i}
                onClick={() => setValue(field.id, opt)}
                className={`w-full text-left px-5 py-4 rounded-lg border-2 transition-all text-base ${
                  val === opt ? 'border-current bg-current/10 font-medium' : 'border-border hover:border-current/50'
                }`}
                style={{ color: val === opt ? primaryColor : undefined, borderColor: val === opt ? primaryColor : undefined }}
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded border text-xs mr-3 font-bold"
                  style={{ borderColor: primaryColor, color: primaryColor }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        );
      case 'multi_select':
        const selected = (val as string[]) || [];
        return (
          <div className="space-y-3">
            {(field.options || []).map((opt, i) => {
              const isChecked = selected.includes(opt);
              return (
                <button
                  key={i}
                  onClick={() => {
                    const next = isChecked ? selected.filter(s => s !== opt) : [...selected, opt];
                    setValue(field.id, next);
                  }}
                  className={`w-full text-left px-5 py-4 rounded-lg border-2 transition-all text-base flex items-center gap-3 ${
                    isChecked ? 'border-current bg-current/10 font-medium' : 'border-border hover:border-current/50'
                  }`}
                  style={{ color: isChecked ? primaryColor : undefined, borderColor: isChecked ? primaryColor : undefined }}
                >
                  <Checkbox checked={isChecked} className="pointer-events-none" />
                  {opt}
                </button>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` }}>
      <div className="w-full max-w-xl mx-auto">
        {/* Progress */}
        {!isWelcome && !isThankYou && (
          <div className="mb-8">
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${((step + 1) / fields.length) * 100}%`, background: primaryColor }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{step + 1} de {fields.length}</p>
          </div>
        )}

        {/* Welcome screen */}
        {isWelcome && (
          <div className="text-center space-y-6 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>{formName}</h1>
            <p className="text-muted-foreground text-lg">Responda algumas perguntas rápidas.</p>
            <Button size="lg" onClick={next} style={{ background: primaryColor }} className="text-white">
              Começar
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Question */}
        {currentField && !isThankYou && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300" key={currentField.id}>
            <h2 className="text-2xl font-semibold">
              {currentField.label}
              {currentField.required && <span className="text-destructive ml-1">*</span>}
            </h2>
            {renderField(currentField)}
            <div className="flex items-center gap-3">
              {step > 0 && (
                <Button variant="outline" onClick={prev}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              )}
              <Button
                onClick={next}
                disabled={!canProceed() || submitting}
                style={{ background: primaryColor }}
                className="text-white"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === fields.length - 1 ? (
                  <>
                    Enviar
                    <Check className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Próximo
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
              {!submitting && canProceed() && (
                <span className="text-xs text-muted-foreground">
                  pressione <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">Enter ↵</kbd>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Thank you screen */}
        {isThankYou && (
          <div className="text-center space-y-6 animate-in fade-in duration-500">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ background: primaryColor }}>
              <Check className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">{settings.thank_you_title || 'Obrigado!'}</h1>
            <p className="text-muted-foreground text-lg">
              {settings.thank_you_message || 'Suas informações foram enviadas com sucesso.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
