import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'colors.dart';

class AtozTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AtozColors.background,
      colorScheme: ColorScheme.dark(
        primary: AtozColors.burgundy,
        onPrimary: Colors.white,
        secondary: AtozColors.gold,
        onSecondary: AtozColors.burgundy,
        surface: AtozColors.surface,
        onSurface: AtozColors.onSurface,
        error: Colors.redAccent,
      ),
      textTheme: GoogleFonts.philosopherTextTheme(
        ThemeData.dark().textTheme,
      ).apply(
        bodyColor: Colors.white,
        displayColor: AtozColors.gold,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.philosopher(
          color: AtozColors.gold,
          fontSize: 24,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AtozColors.burgundy,
          foregroundColor: Colors.white,
          elevation: 8,
          shadowColor: AtozColors.gold.withOpacity(0.3),
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AtozColors.gold, width: 0.5),
          ),
          textStyle: GoogleFonts.philosopher(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.1,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AtozColors.surface,
        labelStyle: const TextStyle(color: AtozColors.gold),
        hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AtozColors.gold.withOpacity(0.5)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AtozColors.gold.withOpacity(0.3)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AtozColors.gold, width: 1.5),
        ),
      ),
    );
  }
}
