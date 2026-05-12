# 📋 Analisi Refactoring: Spostamento Logica dal Frontend al Backend

## 📌 Stato Attuale

### Architettura Corrente
```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • SwapModal + CopyWeekModal (UI)                        │ │
│ │ • useCalendar.ts (logica turni)                         │ │
│ │ • RequestsContext.tsx (logica swap)                     │ │
│ │ • Chiamate dirette a Supabase (RPC + SQL)             │ │
│ │ • Notifiche Push/Email (inviate dal FE)               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓↓↓ Diretto SQL/RPC
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL + RPC/Rules)              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • create_swap_request() - RPC con validazioni         │ │
│ │ • respond_to_swap_request() - RPC con swaps           │ │
│ │ • Regole RLS (Row-Level Security)                     │ │
│ │ • Trigger per updated_at                              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Problemi Identificati ⚠️

1. **Logica Sparsa**
   - Validazioni distribuite tra FE, RPC Supabase, Rules RLS
   - Difficile da manutenere e testare
   
2. **Responsabilità Miste**
   - Frontend gestisce logica di business (copia settimana, swap requests)
   - RPC PostgreSQL gestisce ulteriore logica
   
3. **Difficile da Scalare**
   - Aggiungere nuovi endpoint richiede modifiche a frontend + RPC
   - Logica di notifiche sparsa tra frontend e RPC
   
4. **Testing Complesso**
   - Logica di business non è testabile al livello del backend

---

## 🎯 Stato Target: Architettura Proposta

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • UI Components (SwapModal, CopyWeekModal)            │ │
│ │ • Minimal State Management                            │ │
│ │ • Simple HTTP calls to Backend API                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                    ↓↓↓ REST API Calls
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (C# .NET WebAPI)                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Controllers:                                           │ │
│ │  • POST /shifts/create                                │ │
│ │  • POST /shifts/copy-week                             │ │
│ │  • POST /swap-requests/create                         │ │
│ │  • POST /swap-requests/{id}/respond                   │ │
│ │                                                        │ │
│ │ Services (Business Logic):                            │ │
│ │  • ShiftService - Turni, copy week                    │ │
│ │  • SwapRequestService - Cambio turni                  │ │
│ │  • NotificationService - Push & Email                 │ │
│ │                                                        │ │
│ │ Facades (Data Access):                                │ │
│ │  • ShiftFacade, SwapRequestFacade                     │ │
│ │  • EmployeeFacade, NotificationFacade                 │ │
│ │                                                        │ │
│ │ Validations & Exceptions                              │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                    ↓↓↓ EF Core ORM
┌─────────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • Tables (senza RPC, logica nel backend)             │ │
│ │ • RLS policies (solo lettura/scritti)                 │ │
│ │ • Triggers semplici                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Refactoring Step-by-Step

### 1️⃣ SWAP REQUESTS - Cambio Turno

#### Stato Attuale
```typescript
// Frontend (RequestsContext.tsx)
const createSwapRequest = async ({ shiftId, targetEmployeeIds }) => {
  for (const targetEmployeeId of targetEmployeeIds) {
    await supabase.rpc('create_swap_request', {
      p_shift_id: shiftId,
      p_requester_id: user.id,
      p_target_employee_id: targetEmployeeId,
    });
  }
  await sendPushNotification(...);
  await sendEmailNotification(...);
}
```

**Logica attuale in RPC Supabase:**
- ✅ Verifica che richiedente sia assegnato al turno
- ✅ Verifica che target NON sia già assegnato
- ✅ Verifica che non esista richiesta pending duplicata
- ✅ Inserisce in swap_requests

#### Architettura Target

**Backend C# - Nuovo Endpoint:**
```
POST /swap-requests/create
Body:
{
  "shiftId": "uuid",
  "targetEmployeeIds": ["uuid1", "uuid2"]
}
Response:
{
  "success": true,
  "swapRequestIds": ["id1", "id2"],
  "notificationsSent": 2
}
```

**Backend C# - Nuova Service:**
```csharp
public class SwapRequestService
{
  // Spostare tutta la logica dalla RPC
  public async Task<List<Guid>> CreateSwapRequestsAsync(
    Guid shiftId, 
    Guid requesterId, 
    List<Guid> targetEmployeeIds
  )
  {
    // 1. Validazioni
    //    - Richiedente assegnato a turno
    //    - Target non assegnato a turno
    //    - Nessuna richiesta pending duplicata
    
    // 2. Creazione (batch)
    //    - Insert in swap_requests
    
    // 3. Notifiche
    //    - Push notifications
    //    - Email notifications
    
    // 4. Return IDs
  }
  
  public async Task RespondToSwapRequestAsync(
    Guid requestId, 
    string decision,
    Guid responderId
  )
  {
    // 1. Validazioni
    //    - Request esiste e pending
    //    - Responder è il target
    
    // 2. Accept logic
    //    - Se accept: swappa gli assignment
    //    - Se reject: marcà rifiutato
    
    // 3. Notifiche
    //    - Notifica al richiedente
    
    // 4. Cleanup
    //    - Cancella richieste conflittuali
  }
}
```

**Frontend Changes:**
```typescript
// Prima (RPC diretto)
await supabase.rpc('create_swap_request', { ... });

// Dopo (API REST)
const response = await fetch('http://localhost:8080/swap-requests/create', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ shiftId, targetEmployeeIds })
});
const data = await response.json();
```

---

### 2️⃣ COPY WEEK - Copia Settimana

#### Stato Attuale
```typescript
// Frontend (useCalendar.ts)
const copyWeek = async ({ startDate, endDate }) => {
  const sourceWeek = weekDays.map(day => ({
    date: day,
    shift: getShiftForDay(day)
  }));
  
  const startMonday = getMondayOfWeek(new Date(startDate));
  const endMonday = getMondayOfWeek(new Date(endDate));
  
  // Loop per ogni settimana
  for (let monday of weeksInRange) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      // Clone turno per ogni giorno
      await persistShiftForDate(targetKey, clonedShift);
    }
  }
}
```

**Problemi:**
- Logica di iterazione nel frontend
- Tante chiamate database (una per giorno/settimana)
- No transazioni: se fallisce uno potrebbe essere incompleto

#### Architettura Target

**Backend C# - Nuovo Endpoint:**
```
POST /shifts/copy-week
Body:
{
  "sourceMonday": "2026-03-24",
  "startDate": "2026-03-31",
  "endDate": "2026-05-31"
}
Response:
{
  "success": true,
  "weeksProcessed": 9,
  "shiftsCreated": 63,
  "message": "Settimana copiata su 9 settimane (63 turni)"
}
```

**Backend C# - Nuova Service:**
```csharp
public class ShiftService
{
  public async Task<ShiftCopyResult> CopyWeekAsync(
    DateTime sourceMonday,
    DateTime startDate,
    DateTime endDate
  )
  {
    using var transaction = await dbContext.Database.BeginTransactionAsync();
    
    try
    {
      // 1. Carica settimana sorgente con i turni
      var sourceShifts = await facade.GetShiftsForWeekAsync(sourceMonday);
      
      // 2. Calcola tutte le settimane target
      var targetMondays = GetMondaysInRange(startDate, endDate);
      
      // 3. Per ogni settimana target
      foreach (var targetMonday in targetMondays)
      {
        // Skip se è la settimana sorgente
        if (targetMonday == sourceMonday) continue;
        
        // Clona tutti i turni della settimana
        for (int dayOffset = 0; dayOffset < 7; dayOffset++)
        {
          var sourceShift = sourceShifts[dayOffset];
          var targetDate = targetMonday.AddDays(dayOffset);
          
          await CopyShiftAsync(sourceShift, targetDate);
        }
      }
      
      // 4. Commit transazione
      await transaction.CommitAsync();
      
      return new ShiftCopyResult
      {
        Success = true,
        WeeksProcessed = targetMondays.Count,
        ShiftsCreated = targetMondays.Count * 7
      };
    }
    catch
    {
      await transaction.RollbackAsync();
      throw;
    }
  }
}
```

**Frontend Changes:**
```typescript
// Prima (logica FE, tante chiamate DB)
await copyWeek({ startDate, endDate });

// Dopo (una sola chiamata, logica nel backend)
const response = await fetch('http://localhost:8080/shifts/copy-week', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    sourceMonday: formatDate(currentMonday),
    startDate,
    endDate
  })
});
```

---

### 3️⃣ SHIFT MANAGEMENT - Gestione Turni

#### Stato Attuale
```typescript
// Frontend (useCalendar.ts)
const saveShift = async (date, shiftData) => {
  // Upsert shift per data
  const shiftRow = await supabase.from('shifts')
    .upsert({ work_date: date, is_closed: shiftData.closed })
    .select('id')
    .single();
  
  // Cancella assignment precedenti
  await supabase.from('shift_assignments')
    .delete()
    .eq('shift_id', shiftRow.id);
  
  // Inserisci nuovi assignment
  await supabase.from('shift_assignments')
    .insert(shiftData.employees.map(emp => ({
      shift_id: shiftRow.id,
      employee_id: emp.id,
      is_partial: emp.partial
    })));
}
```

#### Architettura Target

**Backend C# - Nuovi Endpoint:**
```
POST /shifts
{
  "workDate": "2026-03-25",
  "isClosed": false,
  "employees": [
    { "employeeId": "uuid1", "isPartial": false },
    { "employeeId": "uuid2", "isPartial": true }
  ]
}

DELETE /shifts/{id}
```

**Backend C# - Nuova Service:**
```csharp
public class ShiftService
{
  public async Task<Guid> CreateOrUpdateShiftAsync(
    DateTime workDate,
    bool isClosed,
    List<ShiftAssignmentDto> employees,
    Guid createdBy
  )
  {
    using var transaction = await dbContext.Database.BeginTransactionAsync();
    
    try
    {
      // 1. Upsert shift
      var shift = await facade.GetOrCreateShiftAsync(workDate, createdBy);
      shift.IsClosed = isClosed;
      
      // 2. Cancella assignment precedenti
      var oldAssignments = dbContext.ShiftAssignments
        .Where(sa => sa.ShiftId == shift.Id);
      dbContext.ShiftAssignments.RemoveRange(oldAssignments);
      
      // 3. Inserisci nuovi assignment
      var newAssignments = employees.Select(emp => new ShiftAssignment
      {
        ShiftId = shift.Id,
        EmployeeId = new Guid(emp.EmployeeId),
        IsPartial = emp.IsPartial
      }).ToList();
      
      await dbContext.ShiftAssignments.AddRangeAsync(newAssignments);
      
      // 4. Save & commit
      await dbContext.SaveChangesAsync();
      await transaction.CommitAsync();
      
      return shift.Id;
    }
    catch
    {
      await transaction.RollbackAsync();
      throw;
    }
  }
}
```

---

## 📊 Comparazione Prima/Dopo

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **Logica di business** | Sparsa (FE + RPC) | Centralizzata (Backend) |
| **Transazioni** | RPC gestite da DB | Gestite da .NET (control completo) |
| **Testing** | Difficile | Facile (unit tests su service) |
| **Validazioni** | RPC PostgreSQL | Backend + custom exceptions |
| **Notifiche** | Frontend invoca FE | Backend orchestrate |
| **Performance** | Tante piccole query | Batch operations |
| **Manutenzione** | Sparsa | Centralizzata |
| **Scalabilità** | Bassa | Alta |

---

## 🚀 Roadmap di Implementazione

### FASE 1: Infrastruttura Backend (Oggi)
- ✅ Backend C# già pronto con DI
- ✅ Database schema già definito
- ⏭️ Creare le Facades per dati
- ⏭️ Creare i Services per business logic

### FASE 2: Swap Requests API
1. Creare `SwapRequestService` con tutta la logica
2. Creare `SwapRequestController` con endpoint `/create` e `/{id}/respond`
3. Integrare notifiche (push + email)
4. Testare con Postman/API client
5. Aggiornare frontend a usare endpoint

### FASE 3: Shifts API
1. Creare `ShiftService` con logica di creazione/aggiornamento
2. Creare `ShiftController` con endpoint `/shifts`, `/shifts/{id}`
3. Testare transazioni
4. Aggiornare frontend

### FASE 4: Copy Week API
1. Creare `CopyWeekService` con logica batch
2. Creare endpoint `/shifts/copy-week`
3. Test con vari range (settimane, mesi)
4. Aggiornare frontend

### FASE 5: Cleanup Supabase
1. Mantenere RPC per compatibilità (deprecare)
2. Rimuovere logica da RPC
3. Semplificare RLS rules
4. Documentare migrazione

---

## 📝 Modelli Dati da Aggiungere

```csharp
// Models/Shift.cs (già esiste, per ref)
public class Shift
{
  public Guid Id { get; set; }
  public DateTime WorkDate { get; set; }
  public bool IsClosed { get; set; }
  public Guid? CreatedBy { get; set; }
  public ICollection<ShiftAssignment> Assignments { get; set; }
}

// Models/ShiftAssignment.cs (già esiste)
public class ShiftAssignment
{
  public Guid Id { get; set; }
  public Guid ShiftId { get; set; }
  public Guid EmployeeId { get; set; }
  public bool IsPartial { get; set; }
}

// Models/SwapRequest.cs (già esiste)
public class SwapRequest
{
  public Guid Id { get; set; }
  public Guid ShiftId { get; set; }
  public Guid RequesterId { get; set; }
  public Guid TargetEmployeeId { get; set; }
  public SwapRequestStatus Status { get; set; }
  public DateTime CreatedAt { get; set; }
  public DateTime? RespondedAt { get; set; }
}
```

---

## ✅ Vantaggi della Nuova Architettura

1. **Separazione delle Responsabilità**
   - Frontend = UI + UX
   - Backend = Logica di business
   - Database = Persistenza

2. **Testabilità**
   - Services testabili con unit tests
   - Validazioni testabili
   - Logica di business indipendente da UI

3. **Manutenibilità**
   - Codice centralizzato
   - Facile trovare bug
   - Facile aggiungere feature

4. **Performance**
   - Batch operations
   - Transazioni atomic
   - Fewer DB roundtrips

5. **Scalabilità**
   - Aggiungere endpoint easy
   - Business logic non duplicata
   - Supporto multi-client (mobile, web, etc)

6. **Sicurezza**
   - Validazioni centralizzate
   - Autorizzazione al backend
   - Logica critica non esposta al frontend

---

## 🎓 Conclusion

L'architettura target è **3-Tier moderna** (Frontend → Backend → Database):
- Mantiene la **sicurezza** di Supabase
- Aggiunge **logica centralizzata** del backend
- Semplifica il **frontend** a UI pura
- Facilita **testing** e **manutenzione**
- Prepara il progetto a **scalare**

**Next Step:** Iniziare dalla Fase 2 (Swap Requests API) 🚀
