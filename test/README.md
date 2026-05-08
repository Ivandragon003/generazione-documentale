# Test Suite Comprehensive - MAC Documents API

Questa suite di test copre tutti gli scenari critici del progetto, con focus su **bug detection in real-world scenarios**.

## 📊 Copertura e Struttura

### File di Test Generati

| File | Componente | Scenari Testati | # Test |
|------|-----------|-----------------|--------|
| `documents.service.spec.ts` | DocumentsService | Create, Update, Delete, FindOne, FindAll | ~40 |
| `document-rendering.service.spec.ts` | DocumentRenderingService | Template rendering, Field validation | ~35 |
| `markdown.utils.spec.ts` | Markdown utilities | Parsing, Validation, Normalization | ~50 |
| `http.utils.spec.ts` | HTTP utilities | Pagination, UUID validation, Actor extraction | ~60 |
| `dto-validation.spec.ts` | DTO Validation | Input validation, Type coercion | ~30 |
| `documents.repository.spec.ts` | DocumentsRepository | CRUD operations, DB errors | ~50 |
| `errors.spec.ts` | Error handling | AppError creation, HTTP codes | ~45 |
| **TOTALE** | | | **~310 test** |

---

## 🎯 Strategie di Test

### 1. **Black-Box Tests** (Input/Output)
Testano il comportamento senza conoscenza dell'implementazione:
- Input validi tipici
- Input completamente invalidi
- Tipi di dato sbagliati

**Esempio:**
```typescript
// DocumentsService.create() - Black-box
it("deve sollevare errore se il nome è vuoto", async () => {
  await expect(
    service.create({ name: "   ", templateId: mockId })
  ).rejects.toThrow("Il nome documento e obbligatorio");
});
```

### 2. **Boundary / Edge Cases**
Testano i limiti del sistema:
- Valori minimi e massimi
- Zero, uno, array vuoti
- Stringhe vuote/molto lunghe
- Numeri negativi
- UUID formato edge

**Esempio:**
```typescript
// parsePagination() - Boundary
it("deve accettare offset molto grande", () => {
  const result = parsePagination({ limit: "20", offset: "999999" });
  expect(result.offset).toBe(999999);
});

it("deve rifiutare limit zero", () => {
  expect(() => parsePagination({ limit: "0", offset: "0" })).toThrow();
});
```

### 3. **Failure Modes** (Errori Critici)
Testano cosa succede quando le cose vanno male:
- Dipendenze esterne falliscono
- Database errors
- Input corrotti
- Race conditions
- Stato inconsistente

**Esempio:**
```typescript
// DocumentsService.create() - Failure
it("deve gestire errori nella transazione", async () => {
  dataSource.transaction.mockRejectedValue(
    new Error("Transaction failed")
  );
  
  await expect(service.create(...)).rejects.toThrow();
});
```

### 4. **Integration Tests**
Testano flussi completi end-to-end:
- CRUD workflow completo
- Paginazione realistica
- Validazione a catena

**Esempio:**
```typescript
// DocumentsRepository - Integration
it("deve eseguire ciclo completo CRUD", async () => {
  // Create → Read → Update → Delete
  const created = await repository.insertDocument(...);
  const found = await repository.findById(created.id);
  await repository.updateDocument(...);
  await repository.deleteDocument(created.id);
});
```

---

## 🔍 Scenari Critici Coperti

### ✅ DocumentsService
- ❌ Nome vuoto / whitespace
- ❌ Template non trovato
- ❌ FieldValues non è un oggetto
- ❌ Transazioni fallite
- ✅ Trimming automatico del nome
- ✅ Preservazione dati non aggiornati
- ✅ Paginazione con offset fuori limiti
- ✅ Cancellazione cascata PDF jobs

### ✅ DocumentRenderingService
- ❌ Placeholder non risolti
- ❌ Campi obbligatori mancanti
- ✅ Valori null/empty string detection
- ✅ Valori zero e false come validi (!)
- ✅ Strict mode vs non-strict
- ✅ 100+ placeholder in un template

### ✅ Markdown Utils
- ❌ Contenuto vuoto
- ❌ Parentesi non bilanciate
- ❌ Placeholder malformati
- ❌ Dimensione file > limite
- ✅ UTF-8 multibyte counting
- ✅ Placeholder duplicati (deduplicated)
- ✅ Template da 1000+ placeholder

### ✅ HTTP Utils (Pagination & Validation)
- ❌ limit/offset negativi
- ❌ UUID malformato
- ❌ Non-numeri in pagination
- ❌ Float in offset
- ✅ UUID v1 e v4 valid
- ✅ Leading zeros in numeri
- ✅ Case-insensitive UUID
- ✅ Attore default "system"
- ✅ Offset > risultati totali

### ✅ DocumentsRepository
- ❌ Errori database connection
- ❌ Vincoli unique/foreign key
- ✅ Transazioni concorrenti su stesso ID
- ✅ Large field_values (1000+ campi)
- ✅ Nested objects in fieldValues

### ✅ Error Handling
- ❌ Status code invalidi
- ❌ Messaggi di errore vuoti
- ✅ Tutti gli HTTP status code (100-599)
- ✅ Serializzazione JSON di errori
- ✅ 10.000 errori in < 100ms

---

## 🚀 Come Eseguire i Test

### Eseguire tutti i test
```bash
npm run test
```

### Eseguire test con coverage
```bash
npm run test:cov
```

### Eseguire un file specifico
```bash
npm run test documents.service.spec.ts
```

### Eseguire in watch mode
```bash
npm run test:watch
```

### Filtrare per nome del test
```bash
npm run test -- --testNamePattern="Black-box"
```

---

## 📈 Coverage Targets

Obiettivi di coverage per il progetto:

| Metrica | Target | Attuale |
|---------|--------|---------|
| Statements | 80%+ | [TBD] |
| Branches | 75%+ | [TBD] |
| Functions | 80%+ | [TBD] |
| Lines | 80%+ | [TBD] |

Eseguire: `npm run test:cov` per report dettagliato.

---

## 🐛 Bug Che Questi Test Riuscirebbero a Catturare

### 1. **Type Coercion Errors**
```typescript
// ❌ CATTIVO: Non normalizza input
user.limit = "20"; // string
if (user.limit > 10) { } // Confronto string vs number

// ✅ TEST COPRE: parsePagination valida tipo correttamente
```

### 2. **Nullability Issues**
```typescript
// ❌ CATTIVO: Dimentica null check
function updateDoc(fieldValues) {
  return JSON.stringify(fieldValues); // Crash se null
}

// ✅ TEST COPRE: fieldValues=null rifiutato esplicitamente
```

### 3. **Off-by-One in Pagination**
```typescript
// ❌ CATTIVO: offset >= data.length ritorna record sbagliati
// ✅ TEST COPRE: offset=1000 vs total=50 ritorna []
```

### 4. **Unicode/Encoding Issues**
```typescript
// ❌ CATTIVO: non conta byte UTF-8 correttamente
const size = content.length; // conta caratteri, non byte

// ✅ TEST COPRE: "€".repeat(100) correttamente in byte
```

### 5. **Race Conditions**
```typescript
// ✅ TEST COPRE: 5 update concorrenti su stesso ID
Promise.all([...])
```

### 6. **State Mutation**
```typescript
// ❌ CATTIVO: modifica l'input
function update(doc, fieldValues) {
  fieldValues.extra = ""; // Mutazione!
}

// ✅ TEST COPRE: update non modifica input original
```

---

## 📋 Checklist di Test

Prima di mergare codice:

- [ ] Tutti i test passano: `npm run test`
- [ ] Coverage > 80%: `npm run test:cov`
- [ ] Nessun test skipped (`.skip()`, `.only()`)
- [ ] Nessun warning di test lento (> 100ms per test)
- [ ] Nuovi test aggiunti per nuove feature
- [ ] Test aggiornati se behavior cambia

---

## 🔧 Struttura di un Test

### Template per nuovo test (Copy-Paste)

```typescript
describe("ComponentName", () => {
  let component: ComponentName;

  beforeEach(async () => {
    // Setup
  });

  describe("methodName() - Black-box tests", () => {
    it("deve fare X con input valido", async () => {
      // Arrange
      const input = {...};
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toEqual(...);
    });

    it("deve rifiutare Y non valido", async () => {
      // Arrange
      const invalid = {...};
      
      // Act & Assert
      await expect(component.method(invalid)).rejects.toThrow();
    });
  });

  describe("methodName() - Boundary cases", () => {
    it("deve gestire limite massimo", () => {
      // Test con MAX_VALUE, very long strings, etc.
    });
  });

  describe("methodName() - Failure modes", () => {
    it("deve gestire errori di dipendenza", async () => {
      // Mock error e verificare handling
    });
  });
});
```

---

## 🎓 Insegnamenti da Questa Suite

1. **Null è un valore valido** - Testare `null`, `undefined`, `""`, `0`, `false` separatamente
2. **Offset > total è valido** - Ritorna lista vuota, non errore
3. **UTF-8 count in byte** - Non usare `.length` per limiti dimensione
4. **Concurrent operations** - Race conditions succedono in produzione
5. **Type coercion gotchas** - String "0" è truthy ma parseInt("0") è 0
6. **Status code semantics** - 404 != 400 != 500
7. **Transaction isolation** - Mock il transaction manager, non la logica

---

## 📞 Supporto

Se test falliscono in CI:
1. Verifica che le dipendenze esterne (DB, file system) siano disponibili
2. Aumenta timeout se test lento: `.timeout(5000)`
3. Check logs per errori di mocking
4. Testa localmente prima di push

---

**Generated:** 2024 | **Framework:** Jest | **Coverage Type:** Comprehensive
