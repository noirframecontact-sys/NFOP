# NFOP 4.1 — Manifest architektury

**Status:** ✅ **Zaakceptowany** — 2026-07-07  
**Poprzednik:** [`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md) (NFOP 4.0)  
**Powód powstania:** pierwsze testy terenowe (Operator/Centrala + Supervisor, dwa urządzenia)

---

## Zasada nadrzędna

> **NFOP ma odwzorowywać sposób pracy Noir Frame, a nie zmuszać Noir Frame do pracy według ograniczeń programu.**

Każda decyzja architektoniczna — model danych, synchronizacja, UI, uprawnienia — musi przejść test: *czy to odzwierciedla realny przepływ pracy firmy?*

---

## 1. Jeden wspólny kalendarz

Istnieje tylko **jeden kalendarz** dla całej firmy.

Widoczne są zawsze:

- 🔴 **Zlecenia** (Aufträge)
- 🔵 **Blokady Supervisora**

Synchronizacja odbywa się **automatycznie** przez Supabase Realtime.

Nie ma dwóch kalendarzy. Są dwa widoki na ten sam stan.

---

## 2. Blokada = ochrona tymczasowa

Blokada **nie jest rezerwacją**.

Blokada chroni termin przed **przypadkowym** przyjęciem zlecenia.

- Supervisor może ją **w każdej chwili usunąć**
- Po usunięciu blokady wszystkie urządzenia **natychmiast** widzą wolny termin
- Blokada jest **odwracalna w czasie rzeczywistym** — jej celem jest ochrona kalendarza, nie trwałe zamknięcie terminu

---

## 3. Zlecenie = wspólny stan projektu

Każda zmiana projektu zapisuje się **natychmiast**:

- klient
- oferta
- Vertrag
- Anzahlung
- checklista
- status

Operator i Supervisor **zawsze** widzą ten sam stan.

Nie używamy ręcznej synchronizacji do codziennej pracy.

---

## 4. Zlecenie ma pierwszeństwo

**Reguła biznesowa:** jeżeli pojawia się zlecenie, 🔴 **wygrywa** z 🔵.

- Blokada Supervisora pozostaje **odwracalna**
- **Kontrakt z klientem jest nadrzędny** wobec ochrony kalendarza
- Konflikt RED + BLUE nie jest błędem systemu — to sygnał do decyzji Supervisora

---

## 5. Volvo Trunk

Volvo Trunk **nie służy** do codziennej synchronizacji.

Realtime obsługuje normalną pracę.

Volvo pozostaje wyłącznie dla sytuacji wyjątkowych:

- praca offline
- konflikty synchronizacji
- backup
- import
- odzyskiwanie danych

Na co dzień użytkownik **nie powinien** korzystać z Volvo Trunk.

---

## 6. Operator nie myśli o synchronizacji

Synchronizacja ma być **niewidoczna**.

- Operator pracuje
- Supervisor pracuje
- System synchronizuje wszystko sam

> *Operator nie powinien myśleć o synchronizacji. Operator powinien myśleć o kliencie.*

---

## 7. Jedna aplikacja

NFOP jest **identyczny** na każdym urządzeniu.

Nie ma osobnych wersji Operator i Supervisor.

- Jedna aplikacja
- Jedna baza
- Jedna prawda

Różnica wynika wyłącznie z **wykonywanej pracy**:

- **Centrala** planuje, tworzy zlecenia, kontaktuje się z klientami
- **Supervisor** realizuje zlecenia i aktualizuje ich przebieg

---

## 8. Moose Mode i Panel Supervisora

Jedynym ograniczeniem **nie są** role użytkowników.

Jedynym ograniczeniem są:

- 🔐 **Panel Supervisora** (hasło) — blokady, ustawienia, raporty
- 🫎 **Moose Mode** (ukryte wejście + hasło) — backup, delete, import, diagnostyka, narzędzia serwisowe

To zabezpieczenie funkcji **administracyjnych i serwisowych**, a nie system uprawnień.

Angelo nie musi wiedzieć, że Moose Mode istnieje.

---

## Relacja do NFOP 4.0

| NFOP 4.0 | NFOP 4.1 |
|----------|----------|
| Realtime → Volvo Trunk → ręczne SYNCHRO | Realtime auto-apply dla codziennej pracy |
| Operator kontroluje workspace (wszystko) | Workspace chroniony; kalendarz i stan projektu — auto |
| Blokady w `localStorage` | Blokady w Supabase + Realtime |
| SYNCHRO widoczne w hero | SYNCHRO/Volvo tylko dla wyjątków |

Tam, gdzie manifest 4.1 koliduje z `DESIGN-PRINCIPLES.md` (4.0), **obowiązuje manifest 4.1**.

---

## Kolejne kroki (po akceptacji manifestu)

1. Analiza techniczna punktu 1 — wspólny kalendarz (model Supabase, Calendar Lane)
2. Praca na **klonie lokalnym** + Live Server — nie na produkcji
3. Implementacja fazowa — dopiero po akceptacji modelu danych

**Nie implementujemy wszystkiego naraz.**

---

## Motto

> *Operator nie powinien myśleć o synchronizacji. Operator powinien myśleć o kliencie.*
