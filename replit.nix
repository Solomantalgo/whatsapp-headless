{ pkgs }: 
{
  deps = [
    pkgs.nodejs-22_x
    pkgs.chromium
    pkgs.glib
    pkgs.glibc
    pkgs.cups
    pkgs.nss
    pkgs.fontconfig
    pkgs.gconf
    pkgs.cairo
    pkgs.pango
    pkgs.gtk3
  ];
}
