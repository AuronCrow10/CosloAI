import React from "react";

type SettingsLayoutProps = {
  header: React.ReactNode;
  main: React.ReactNode;
  sidebar?: React.ReactNode;
};

const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  header,
  main,
  sidebar
}) => {
  const hasSidebar = Boolean(sidebar);

  return (
    <div className="settings-page">
      <div className="settings-container">
        {header}
        <div
          className={
            "settings-grid" + (hasSidebar ? "" : " settings-grid--no-sidebar")
          }
        >
          <div className="settings-main">{main}</div>
          {hasSidebar && <aside className="settings-sidebar">{sidebar}</aside>}
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;
