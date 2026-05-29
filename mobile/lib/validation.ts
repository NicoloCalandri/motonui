export interface NewTripData {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface ExpenseInput {
  description: string;
  amount: number;
  currency: string;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeTextInput(value: string, maxLength = 500): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength);
}

function normalizeOptionalDate(value: string): string {
  return value.trim();
}

function parseDateInput(value: string): number | null {
  if (!DATE_REGEX.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) return null;
  return timestamp;
}

export function validateTripInput(data: NewTripData): NewTripData {
  const title = sanitizeTextInput(data.title, 200);
  const destination = sanitizeTextInput(data.destination, 200);
  const description = sanitizeTextInput(data.description, 2000);
  const start_date = normalizeOptionalDate(data.start_date);
  const end_date = normalizeOptionalDate(data.end_date);

  if (!title) {
    throw new Error('Inserisci il nome del viaggio.');
  }

  if (!destination) {
    throw new Error('Inserisci la destinazione del viaggio.');
  }

  const startTs = start_date ? parseDateInput(start_date) : null;
  const endTs = end_date ? parseDateInput(end_date) : null;

  if (start_date && startTs === null) {
    throw new Error('Data inizio non valida. Usa il formato AAAA-MM-GG.');
  }

  if (end_date && endTs === null) {
    throw new Error('Data fine non valida. Usa il formato AAAA-MM-GG.');
  }

  if (startTs !== null && endTs !== null && endTs < startTs) {
    throw new Error('La data di fine non puo essere precedente alla data di inizio.');
  }

  return {
    title,
    destination,
    start_date,
    end_date,
    description,
  };
}

export function validateExpenseInput(descriptionValue: string, amountValue: string, currencyValue: string): ExpenseInput {
  const description = sanitizeTextInput(descriptionValue, 500);
  const amount = Number.parseFloat(amountValue);
  const currency = currencyValue.trim().toUpperCase();

  if (!description) {
    throw new Error('Inserisci una descrizione valida.');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Inserisci un importo maggiore di zero.');
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('Valuta non valida. Usa un codice a 3 lettere (es. EUR).');
  }

  return { description, amount, currency };
}
