import 'package:flutter/material.dart';
import 'package:glassmorphism/glassmorphism.dart';
import '../core/colors.dart';

class FuturisticCard extends StatelessWidget {
  final Widget child;
  final double height;
  final double width;
  final double borderRadius;

  const FuturisticCard({
    super.key,
    required this.child,
    this.height = 200,
    this.width = double.infinity,
    this.borderRadius = 20,
  });

  @override
  Widget build(BuildContext context) {
    return GlassmorphicContainer(
      width: width,
      height: height,
      borderRadius: borderRadius,
      blur: 20,
      alignment: Alignment.bottomCenter,
      border: 2,
      linearGradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AtozColors.burgundy.withOpacity(0.1),
            AtozColors.burgundy.withOpacity(0.05),
          ],
          stops: const [0.1, 1]),
      borderGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          AtozColors.gold.withOpacity(0.5),
          AtozColors.gold.withOpacity(0.2),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: child,
      ),
    );
  }
}
