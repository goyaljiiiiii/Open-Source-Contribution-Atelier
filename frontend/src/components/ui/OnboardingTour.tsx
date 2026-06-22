import React from "react";
import { Joyride, EventData, STATUS, Step } from "react-joyride";

interface OnboardingTourProps {
  run: boolean;
  onFinish: () => void;
}

export function OnboardingTour({ run, onFinish }: OnboardingTourProps) {
  const steps: Step[] = [
    {
      target: "#tour-welcome",
      content: "Welcome to the Atelier! This is your personal dashboard where you can track your journey through the open-source curriculum.",
      placement: "bottom",
      skipBeacon: true,
    },
    {
      target: "#tour-stats",
      content: "Here you can track your progress. Keep your streak alive, merge PRs, and watch your rank climb!",
      placement: "bottom",
    },
    {
      target: "#tour-fact",
      content: "Learn something new every day! We share daily facts about the history and impact of the open-source movement.",
      placement: "top",
    },
    {
      target: "#tour-certificate",
      content: "Your ultimate goal. Complete 100% of the curriculum to unlock your graduation certificate.",
      placement: "top",
    },
    {
      target: "#tour-learning-queue",
      content: "Ready to learn? Jump right back into your next module from this queue. Happy coding!",
      placement: "top",
    },
  ];

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      onFinish();
    }
  };

  return (
    <Joyride
      onEvent={handleJoyrideCallback}
      continuous
      run={run}
      scrollToFirstStep
      steps={steps}
      options={{
        zIndex: 10000,
        primaryColor: "#ff9500",
        backgroundColor: "#ffffff",
        textColor: "#000000",
        overlayColor: "rgba(0, 0, 0, 0.6)",
        buttons: ["back", "skip", "primary"],
      }}
      styles={{
        tooltip: {
          borderRadius: "24px",
          border: "4px solid #000000",
          boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
          padding: "20px",
          fontFamily: "inherit",
        },
        tooltipContainer: {
          textAlign: "left",
        },
        tooltipTitle: {
          fontWeight: 900,
          fontSize: "1.25rem",
        },
        tooltipContent: {
          fontWeight: 700,
          color: "#4a4a4a", // muted
          padding: "10px 0",
        },
        buttonPrimary: {
          backgroundColor: "#ff9500",
          border: "2px solid #000000",
          borderRadius: "12px",
          color: "#000000",
          fontWeight: 900,
          padding: "8px 16px",
          boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)",
          transition: "transform 0.1s",
        },
        buttonBack: {
          color: "#000000",
          fontWeight: 900,
          marginRight: "10px",
        },
        buttonSkip: {
          color: "#ff3b30",
          fontWeight: 900,
        },
      }}
    />
  );
}
