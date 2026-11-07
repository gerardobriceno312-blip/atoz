class ScoringUtils {
  static int calculatePoints({
    required int predA,
    required int predB,
    required int realA,
    required int realB,
  }) {
    // 1. Acierto Exacto (Marcador idéntico)
    if (predA == realA && predB == realB) {
      return 5;
    }

    // Determinar resultados (1 = Gana A, 2 = Gana B, 0 = Empate)
    int predResult = predA > predB ? 1 : (predA < predB ? 2 : 0);
    int realResult = realA > realB ? 1 : (realA < realB ? 2 : 0);

    // 2. Acierto de Ganador o Empate (pero no marcador exacto)
    if (predResult == realResult) {
      return 3;
    }

    // 3. Caso Especial: El usuario eligió un ganador pero hubo EMPATE
    if (predResult != 0 && realResult == 0) {
      return 1;
    }

    // 4. No acertó nada
    return 0;
  }
}
