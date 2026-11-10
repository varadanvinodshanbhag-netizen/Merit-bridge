using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;
using Microsoft.Win32;

namespace MeritBridgeInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }

    public class InstallerForm : Form
    {
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button installButton;
        private CheckBox launchCheckBox;

        public InstallerForm()
        {
            this.Text = "MeritBridge Setup";
            this.Size = new Size(480, 260);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(248, 250, 252);
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            Label titleLabel = new Label();
            titleLabel.Text = "MeritBridge Placement & Analytics";
            titleLabel.Font = new Font("Segoe UI", 13f, FontStyle.Bold);
            titleLabel.ForeColor = Color.FromArgb(15, 23, 42);
            titleLabel.Location = new Point(24, 20);
            titleLabel.AutoSize = true;
            this.Controls.Add(titleLabel);

            Label descLabel = new Label();
            descLabel.Text = "Click Install to set up MeritBridge on this computer.";
            descLabel.ForeColor = Color.FromArgb(71, 85, 105);
            descLabel.Location = new Point(26, 52);
            descLabel.AutoSize = true;
            this.Controls.Add(descLabel);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(26, 90);
            progressBar.Size = new Size(410, 24);
            progressBar.Style = ProgressBarStyle.Blocks;
            progressBar.Visible = false;
            this.Controls.Add(progressBar);

            statusLabel = new Label();
            statusLabel.Text = "";
            statusLabel.ForeColor = Color.FromArgb(100, 116, 139);
            statusLabel.Location = new Point(26, 122);
            statusLabel.Size = new Size(410, 20);
            this.Controls.Add(statusLabel);

            launchCheckBox = new CheckBox();
            launchCheckBox.Text = "Launch MeritBridge after installation";
            launchCheckBox.Checked = true;
            launchCheckBox.Location = new Point(26, 150);
            launchCheckBox.AutoSize = true;
            this.Controls.Add(launchCheckBox);

            installButton = new Button();
            installButton.Text = "Install";
            installButton.Size = new Size(110, 36);
            installButton.Location = new Point(326, 170);
            installButton.BackColor = Color.FromArgb(37, 99, 235);
            installButton.ForeColor = Color.White;
            installButton.FlatStyle = FlatStyle.Flat;
            installButton.FlatAppearance.BorderSize = 0;
            installButton.Cursor = Cursors.Hand;
            installButton.Click += InstallButton_Click;
            this.Controls.Add(installButton);
        }

        private void InstallButton_Click(object sender, EventArgs e)
        {
            installButton.Enabled = false;
            progressBar.Visible = true;
            progressBar.Value = 10;
            statusLabel.Text = "Checking WebView2 runtime...";
            Application.DoEvents();

            CheckWebView2();

            string installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "MeritBridge");
            if (!Directory.Exists(installDir))
            {
                Directory.CreateDirectory(installDir);
            }

            progressBar.Value = 30;
            statusLabel.Text = "Extracting MeritBridge files...";
            Application.DoEvents();

            ExtractResource("MeritBridge.exe", Path.Combine(installDir, "MeritBridge.exe"));
            progressBar.Value = 60;
            statusLabel.Text = "Extracting runtime dependencies...";
            Application.DoEvents();

            ExtractResource("WebView2Loader.dll", Path.Combine(installDir, "WebView2Loader.dll"));
            ExtractResource("libunwind.dll", Path.Combine(installDir, "libunwind.dll"));

            progressBar.Value = 85;
            statusLabel.Text = "Creating Desktop shortcut...";
            Application.DoEvents();

            string exePath = Path.Combine(installDir, "MeritBridge.exe");
            CreateShortcut(exePath, installDir);

            progressBar.Value = 100;
            statusLabel.Text = "Installation complete!";
            installButton.Text = "Finished";
            installButton.Enabled = true;
            installButton.Click -= InstallButton_Click;
            installButton.Click += (s, args) => this.Close();

            if (launchCheckBox.Checked)
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = exePath,
                    WorkingDirectory = installDir
                });
                this.Close();
            }
        }

        private void ExtractResource(string resourceName, string targetPath)
        {
            Assembly assembly = Assembly.GetExecutingAssembly();
            using (Stream stream = assembly.GetManifestResourceStream(resourceName))
            {
                if (stream == null)
                {
                    throw new Exception("Resource not found: " + resourceName);
                }
                using (FileStream fileStream = new FileStream(targetPath, FileMode.Create, FileAccess.Write))
                {
                    byte[] buffer = new byte[65536];
                    int bytesRead;
                    while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        fileStream.Write(buffer, 0, bytesRead);
                    }
                }
            }
        }

        private void CreateShortcut(string targetExe, string workingDir)
        {
            try
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktop, "MeritBridge.lnk");
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetExe;
                    shortcut.WorkingDirectory = workingDir;
                    shortcut.Description = "MeritBridge Placement Management";
                    shortcut.Save();
                }

                string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                string startShortcut = Path.Combine(startMenu, "MeritBridge.lnk");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(startShortcut);
                    shortcut.TargetPath = targetExe;
                    shortcut.WorkingDirectory = workingDir;
                    shortcut.Description = "MeritBridge Placement Management";
                    shortcut.Save();
                }
            }
            catch { }
        }

        private void CheckWebView2()
        {
            try
            {
                bool found = false;
                string[] regKeys = new string[]
                {
                    @"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-6E2A-4216-BDE8-E6C33C50C00A}",
                    @"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-6E2A-4216-BDE8-E6C33C50C00A}"
                };

                foreach (string subKey in regKeys)
                {
                    using (RegistryKey key = Registry.LocalMachine.OpenSubKey(subKey))
                    {
                        if (key != null && key.GetValue("pv") != null) { found = true; break; }
                    }
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(subKey))
                    {
                        if (key != null && key.GetValue("pv") != null) { found = true; break; }
                    }
                }

                if (!found)
                {
                    DialogResult res = MessageBox.Show(
                        "Microsoft Edge WebView2 Runtime was not detected.\n\nMeritBridge needs WebView2 to display. Would you like to download it now?",
                        "WebView2 Runtime Required",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Information
                    );
                    if (res == DialogResult.Yes)
                    {
                        Process.Start("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                    }
                }
            }
            catch { }
        }
    }
}
