package com.acepredict.app;

import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long MIN_SPLASH_DURATION_MS = 5000;
    private static final long MAX_SPLASH_DURATION_MS = 15000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showOpeningSplash();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showOpeningSplash() {
        FrameLayout root = findViewById(android.R.id.content);
        if (root == null) return;

        LinearLayout splash = new LinearLayout(this);
        splash.setOrientation(LinearLayout.VERTICAL);
        splash.setGravity(Gravity.CENTER);
        splash.setPadding(dp(24), dp(24), dp(24), dp(24));
        splash.setBackgroundColor(Color.rgb(5, 9, 11));
        splash.setClickable(true);
        splash.setElevation(dp(24));

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ace_predict_launch);
        icon.setScaleType(ImageView.ScaleType.FIT_CENTER);
        icon.setAlpha(0f);
        icon.setScaleX(0.74f);
        icon.setScaleY(0.74f);
        splash.addView(icon, new LinearLayout.LayoutParams(dp(300), dp(300)));

        TextView message = new TextView(this);
        String words = "WE DONT GAMBLE,\nWE INVEST";
        SpannableString styledWords = new SpannableString(words);
        int investStart = words.indexOf("WE INVEST");
        styledWords.setSpan(
            new ForegroundColorSpan(Color.rgb(53, 239, 131)),
            investStart,
            words.length(),
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        );
        message.setText(styledWords);
        message.setTextColor(Color.rgb(232, 198, 106));
        message.setTextSize(20);
        message.setTypeface(Typeface.DEFAULT_BOLD);
        message.setGravity(Gravity.CENTER);
        message.setLetterSpacing(0.12f);
        message.setAlpha(0f);
        message.setTranslationY(dp(14));

        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        messageParams.topMargin = dp(20);
        splash.addView(message, messageParams);

        root.addView(
            splash,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        icon.animate()
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(700)
            .start();

        message.animate()
            .alpha(1f)
            .translationY(0f)
            .setStartDelay(420)
            .setDuration(500)
            .start();

        long startedAt = android.os.SystemClock.uptimeMillis();
        splash.postDelayed(
            () -> hideSplashWhenReady(root, splash, startedAt),
            MIN_SPLASH_DURATION_MS
        );
    }

    private void hideSplashWhenReady(FrameLayout root, LinearLayout splash, long startedAt) {
        boolean pageLoaded = bridge != null
            && bridge.getWebView() != null
            && bridge.getWebView().getProgress() >= 100;
        boolean reachedMaximum =
            android.os.SystemClock.uptimeMillis() - startedAt >= MAX_SPLASH_DURATION_MS;

        if (!pageLoaded && !reachedMaximum) {
            splash.postDelayed(() -> hideSplashWhenReady(root, splash, startedAt), 250);
            return;
        }

        splash.animate()
            .alpha(0f)
            .setDuration(300)
            .withEndAction(() -> root.removeView(splash))
            .start();
    }
}
