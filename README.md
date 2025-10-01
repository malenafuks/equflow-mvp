📋 EquiFlow – Brief v1.6.7
✅ Ukończone (v1.6.6)

Blokada duplikatów: koń ↔ jeździec / godzina.

Limit 3 jazd dziennie / koń → 4. i 5. = ostrzeżenie ⚠️, ale zapis możliwy.

Instruktor ↔ grupy / godzina → blokada (instruktor tylko w jednej grupie o tej godzinie).

Spójność poziomu w grupie → blokada (np. nie mieszamy kłus i teren w jednej grupie).

Usunięcie pola „Przypisz do”.

Ograniczenie usuwania zaakceptowanych zadań.

Możliwość rezygnacji z zadania (wraca do puli).

Taby, toasty i walidacje – stabilne.

🛠 Do wdrożenia (v1.6.7)
1. Synchronizacja usuwania (jazdy ↔ grafik)

Już działa: usunięcie zadania w zakładce Instruktor usuwa je z grafiku.

Do zrobienia: usunięcie jazdy bezpośrednio z grafiku usuwa też wpis w zakładce Instruktor.

2. Grafik zabiegów (nowy panel w Admin)

Osobny widok: Grafik zabiegów.

Pola:

zamiast „Poziom/typ” → Rodzaj zabiegu (dropdown),

„Instruktor” → Instruktor Asystujący.

Logika:

Weterynarz ma kilka godzin i wiele koni,

Instruktor Asystujący przypisany na całą sesję (nie może wtedy prowadzić jazd, ale może robić inne zadania).

Zabiegi dodawane przez Admina i Instruktora.

Zasada dodawania/usuwania → jak przy jazdach.

3. Raporty – naprawa tabeli

Raporty nie renderują się → poprawa generowania danych i widoku.

4. Obsługa zadania „Dziennikarz / Kronikarz”

Teraz: alert „typ nieobsługiwany”.

Docelowo: traktować jak zwykłe zadanie (nie jazda, nie zabieg).

5. Wyszarzanie wykonanych/zaakceptowanych zadań

Zadania w listach zmieniają styl (opacity/szare tło).

Dostępność: aria-disabled.

Brak akcji niszczących.

6. Ulepszenia grafiku

Lepsza responsywność.

Szybkie akcje (hover → usuń / edytuj / podgląd).

7. Zakładka Sklep (beta)

Produkty: gadżety stajenne (bluzy, koszulki).

Produkty za punkty i za gotówkę.

Możliwość zakupu udziału w jazdach/treningach/egzaminach.

8. Profile użytkowników i role

Obozowicze → pełny dostęp w trakcie obozu.

Po obozie → zakładka Wolontariusz wyszarzona / przekierowanie.

Zawsze dostęp do zakładki Sklep.

Opcjonalnie: punkty za akcje marketingowe (np. konkursy SM).

🚀 Milestone’y

v1.6.7 (short-term)
Naprawa raportów, synchronizacja usuwania, obsługa Kronikarza, wyszarzanie zadań.

v1.7.0 (mid-term)
Grafik zabiegów, responsywność grafiku, sklep (beta).

v1.8.0 (long-term)
Profile użytkowników, role i logowanie, system punktów (w tym marketingowe).
