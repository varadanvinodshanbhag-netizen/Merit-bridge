using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Forms;

namespace MeritBridgeLauncher
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string targetDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "MeritBridge");
                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                string exePath = Path.Combine(targetDir, "MeritBridgeApp.exe");
                string dllPath1 = Path.Combine(targetDir, "WebView2Loader.dll");
                string dllPath2 = Path.Combine(targetDir, "libunwind.dll");

                Assembly assembly = Assembly.GetExecutingAssembly();

                // Extract or update embedded files
                ExtractIfNewer(assembly, "MeritBridgeApp.exe", exePath);
                ExtractIfNewer(assembly, "WebView2Loader.dll", dllPath1);
                ExtractIfNewer(assembly, "libunwind.dll", dllPath2);

                // Create or update Desktop shortcut
                EnsureShortcuts(exePath, targetDir);

                // Launch the real application
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = exePath;
                psi.WorkingDirectory = targetDir;
                psi.Arguments = string.Join(" ", args);
                psi.UseShellExecute = true;

                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Error launching MeritBridge:\n" + ex.Message,
                    "MeritBridge Launch Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        static void ExtractIfNewer(Assembly assembly, string resourceName, string targetPath)
        {
            using (Stream stream = assembly.GetManifestResourceStream(resourceName))
            {
                if (stream == null) return;

                // Check if target exists and matches size
                if (File.Exists(targetPath))
                {
                    FileInfo fi = new FileInfo(targetPath);
                    if (fi.Length == stream.Length)
                    {
                        return; // Already up to date
                    }
                }

                using (FileStream fs = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite))
                {
                    byte[] buffer = new byte[65536];
                    int bytesRead;
                    while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        fs.Write(buffer, 0, bytesRead);
                    }
                }
            }
        }

        static void EnsureShortcuts(string targetExe, string workingDir)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                dynamic shell = Activator.CreateInstance(shellType);

                // Start Menu shortcut
                string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                string startLnk = Path.Combine(startMenu, "MeritBridge.lnk");
                dynamic shortcut1 = shell.CreateShortcut(startLnk);
                shortcut1.TargetPath = targetExe;
                shortcut1.WorkingDirectory = workingDir;
                shortcut1.Description = "MeritBridge Placement & Analytics";
                shortcut1.Save();

                // Desktop shortcut
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                if (Directory.Exists(desktop))
                {
                    string desktopLnk = Path.Combine(desktop, "MeritBridge.lnk");
                    dynamic shortcut2 = shell.CreateShortcut(desktopLnk);
                    shortcut2.TargetPath = targetExe;
                    shortcut2.WorkingDirectory = workingDir;
                    shortcut2.Description = "MeritBridge Placement & Analytics";
                    shortcut2.Save();
                }
            }
            catch { }
        }
    }
}
