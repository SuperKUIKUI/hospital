import React, { useState } from "react";
import { Box, Button, Heading, Text, Spinner } from "grommet";

export default function PrescriptionAudit({
  patient,
  diagnosis,
  prescription
}:{
  patient: any,
  diagnosis: string,
  prescription: string
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string|null>(null);

  const runAudit = () => {
    setLoading(true);
    setError(null);

    fetch("http://localhost:8000/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patient,
        diagnosis,
        prescription
      })
    })
      .then(res => res.json())
      .then(data => {
        setResult(data);
        setLoading(false);
      })
      .catch(() => {
        setError("处方审计失败，请稍后再试");
        setLoading(false);
      });
  };

  return (
    <Box
      margin={{ top: "medium" }}
      pad="medium"
      border={{ color: "brand", size: "small" }}
      round="small"
    >
      <Heading level={4}>🧾 处方审计（AI）</Heading>

      <Button
        label="运行处方审计"
        onClick={runAudit}
        primary
        disabled={loading}
      />

      {loading && (
        <Box margin={{ top: "small" }}>
          <Spinner /> <Text>正在审计处方...</Text>
        </Box>
      )}

      {error && (
        <Text color="status-critical" margin={{ top: "small" }}>
          {error}
        </Text>
      )}

      {result && (
        <Box margin={{ top: "medium" }}>
          <Text>
            <strong>结论：</strong>
            <span style={{ color: result.conclusion === "未通过" ? "red" : "green" }}>
              {result.conclusion}
            </span>
          </Text>
          <Text><strong>问题：</strong>{result.problem}</Text>
          <Text><strong>原因：</strong>{result.reason}</Text>
        </Box>
      )}
    </Box>
  );
}
