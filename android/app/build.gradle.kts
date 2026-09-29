plugins {
    id("com.android.application")
}

android {
    namespace = "io.github.hoben.mdviewer"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.hoben.mdviewer"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += setOf("META-INF/DEPENDENCIES", "META-INF/LICENSE*", "META-INF/NOTICE*")
    }
}

val verifyWebAssets = tasks.register("verifyWebAssets") {
    doLast {
        val indexFile = file("src/main/assets/www/index.html")
        require(indexFile.exists()) {
            "Bundled web assets are missing. Run `pnpm android:prepare` from the repository root first."
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn(verifyWebAssets)
}

dependencies {
    implementation("androidx.webkit:webkit:1.17.1")
}
